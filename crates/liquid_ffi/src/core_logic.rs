use crate::arena::EngineState;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;

pub const WG_MAX_FRAME_BYTES: usize = 1232;

#[derive(Serialize)]
pub struct AuditReceipt {
    pub seq: u64,
    pub prev_hash: String,
    pub payload_digest: String,
    pub entry_hash: String,
}

/// Canonical Turn 09 / Turn 19 hash rule:
/// entry_hash = SHA256(seq_u64_be || prev_hash_32 || 0x00 || SHA256(payload))
pub fn append_canonical_record(state: &mut EngineState, payload: &[u8]) -> Result<AuditReceipt, i32> {
    let payload_digest: [u8; 32] = Sha256::digest(payload).into();
    let next_seq = state.seq.checked_add(1).ok_or(-20)?;

    let mut hasher = Sha256::new();
    hasher.update(next_seq.to_be_bytes());
    hasher.update(state.prev_hash);
    hasher.update([0x00u8]);
    hasher.update(payload_digest);
    let next_hash: [u8; 32] = hasher.finalize().into();

    let prev_hex = hex::encode(state.prev_hash);
    let entry_hex = hex::encode(next_hash);
    let digest_hex = hex::encode(payload_digest);

    state.seq = next_seq;
    state.prev_hash = next_hash;

    Ok(AuditReceipt {
        seq: next_seq,
        prev_hash: prev_hex,
        payload_digest: digest_hex,
        entry_hash: entry_hex,
    })
}

pub fn parse_hex_32(hex_str: &str) -> Result<[u8; 32], i32> {
    let clean = hex_str.trim().strip_prefix("sha256:").unwrap_or(hex_str.trim());
    if clean.is_empty() {
        return Ok([0u8; 32]);
    }
    let bytes = hex::decode(clean).map_err(|_| -21)?;
    if bytes.len() != 32 {
        return Err(-21);
    }
    let mut out = [0u8; 32];
    out.copy_from_slice(&bytes);
    Ok(out)
}

#[derive(Deserialize)]
pub struct ParArchitecture {
    pub hash: String,
}

#[derive(Deserialize)]
pub struct ParNonClaims {
    pub shared_memory: bool,
    pub deterministic_compiler: bool,
    pub autonomous_failover: bool,
}

#[derive(Deserialize)]
pub struct ParStep {
    pub step_index: usize,
    pub prev_step_hash: String,
    pub inference_id: String,
    pub cold_start_attested: bool,
    pub qualifier_preserved: bool,
    pub overclaim_detected: bool,
    pub output_payload: String,
    pub output_sha256: String,
}

#[derive(Deserialize)]
pub struct ParArtifact {
    pub par_version: String,
    pub architecture: ParArchitecture,
    pub non_claims: ParNonClaims,
    pub steps: Vec<ParStep>,
    #[serde(default)]
    pub consecutive_drift_count: u32,
}

#[derive(Serialize)]
pub struct ParValidationResult {
    pub exit_code: i32,
    pub status: &'static str,
    pub institutional_audit_required: bool,
    pub reason: String,
}

fn is_valid_sha256_prefixed(s: &str) -> bool {
    let Some(hex_part) = s.strip_prefix("sha256:") else {
        return false;
    };
    hex_part.len() == 64 && hex_part.bytes().all(|b| b.is_ascii_hexdigit())
}

pub fn validate_par_artifact(raw_json: &[u8]) -> ParValidationResult {
    let Ok(doc) = serde_json::from_slice::<ParArtifact>(raw_json) else {
        return ParValidationResult {
            exit_code: 2,
            status: "STRUCTURAL_ERROR",
            institutional_audit_required: true,
            reason: "invalid JSON schema".to_string(),
        };
    };

    if doc.par_version != "1.0" || doc.steps.is_empty() || !is_valid_sha256_prefixed(&doc.architecture.hash) {
        return ParValidationResult {
            exit_code: 2,
            status: "STRUCTURAL_ERROR",
            institutional_audit_required: true,
            reason: "invalid par_version, empty steps, or malformed architecture.hash".to_string(),
        };
    }

    let mut expected_prev = format!("sha256:{}", "0".repeat(64));
    let mut seen_ids = HashSet::with_capacity(doc.steps.len());

    for (idx, step) in doc.steps.iter().enumerate() {
        if step.step_index != idx
            || !is_valid_sha256_prefixed(&step.output_sha256)
            || !is_valid_sha256_prefixed(&step.prev_step_hash)
            || step.prev_step_hash != expected_prev
            || !seen_ids.insert(step.inference_id.as_str())
        {
            return ParValidationResult {
                exit_code: 2,
                status: "STRUCTURAL_ERROR",
                institutional_audit_required: true,
                reason: format!("chain/index/id invariant failed at step {idx}"),
            };
        }
        expected_prev = step.output_sha256.clone();
    }

    if doc.non_claims.shared_memory
        || doc.non_claims.deterministic_compiler
        || doc.non_claims.autonomous_failover
    {
        return ParValidationResult {
            exit_code: 1,
            status: "DRIFT",
            institutional_audit_required: true,
            reason: "non_claims violation".to_string(),
        };
    }

    let mut drift_count = doc.consecutive_drift_count;
    for (idx, step) in doc.steps.iter().enumerate() {
        let computed = format!("sha256:{}", hex::encode(Sha256::digest(step.output_payload.as_bytes())));
        if computed != step.output_sha256
            || !step.cold_start_attested
            || !step.qualifier_preserved
            || step.overclaim_detected
        {
            drift_count = drift_count.saturating_add(1);
            let status = if drift_count >= 2 { "FAILOVER_REQUIRED" } else { "DRIFT" };
            return ParValidationResult {
                exit_code: 1,
                status,
                institutional_audit_required: true,
                reason: format!("attestation/hash/qualifier drift at step {idx}"),
            };
        }
    }

    ParValidationResult {
        exit_code: 0,
        status: "PASS",
        institutional_audit_required: true,
        reason: "verified".to_string(),
    }
}

#[derive(Deserialize, Serialize)]
pub struct WgReportFrame {
    pub finding_id: String,
    pub timestamp: u64,
    pub cell_tower: String,
    pub surface: String,
    pub severity_status: String,
}

pub fn pack_wg_5field_frame(raw_json: &[u8]) -> Result<Vec<u8>, i32> {
    let frame: WgReportFrame = serde_json::from_slice(raw_json).map_err(|_| -30)?;
    let encoded = serde_json::to_vec(&frame).map_err(|_| -31)?;
    if encoded.len() > WG_MAX_FRAME_BYTES {
        return Err(-32);
    }
    Ok(encoded)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canonical_append_updates_seq_and_hash() {
        let mut st = EngineState {
            seq: 0,
            prev_hash: [0u8; 32],
        };
        let r1 = append_canonical_record(&mut st, b"hello").expect("append 1");
        assert_eq!(r1.seq, 1);
        let r2 = append_canonical_record(&mut st, b"world").expect("append 2");
        assert_eq!(r2.seq, 2);
        assert_eq!(r2.prev_hash, r1.entry_hash);
    }

    #[test]
    fn wg_frame_enforces_1232_byte_mtu() {
        let ok = serde_json::json!({
            "finding_id": "F-001",
            "timestamp": 1763930000u64,
            "cell_tower": "310-410-991",
            "surface": "android-arm64",
            "severity_status": "PASS"
        });
        assert!(pack_wg_5field_frame(ok.to_string().as_bytes()).is_ok());

        let oversized = serde_json::json!({
            "finding_id": "F-002",
            "timestamp": 1763930000u64,
            "cell_tower": "310-410-991",
            "surface": "x".repeat(1300),
            "severity_status": "DRIFT"
        });
        assert_eq!(pack_wg_5field_frame(oversized.to_string().as_bytes()), Err(-32));
    }
}
