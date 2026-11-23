use sha2::{Digest, Sha256};
use std::sync::{Mutex, OnceLock};

pub struct EngineState {
    pub seq: u64,
    pub prev_hash: [u8; 32],
}

struct Slot {
    generation: u32,
    state: Option<EngineState>,
}

pub struct HandleArena {
    slots: Vec<Slot>,
    free_list: Vec<u32>,
}

impl HandleArena {
    fn new() -> Self {
        Self {
            slots: Vec::with_capacity(16),
            free_list: Vec::new(),
        }
    }

    pub fn insert(&mut self, state: EngineState) -> Result<u64, i32> {
        if let Some(idx) = self.free_list.pop() {
            let slot = self.slots.get_mut(idx as usize).ok_or(-10)?;
            slot.generation = slot.generation.wrapping_add(1).max(1);
            slot.state = Some(state);
            Ok(pack_handle(idx, slot.generation))
        } else {
            let idx = u32::try_from(self.slots.len()).map_err(|_| -11)?;
            let generation = 1u32;
            self.slots.push(Slot {
                generation,
                state: Some(state),
            });
            Ok(pack_handle(idx, generation))
        }
    }

    pub fn with_mut<F, R>(&mut self, handle: u64, f: F) -> Result<R, i32>
    where
        F: FnOnce(&mut EngineState) -> Result<R, i32>,
    {
        let (idx, gen) = unpack_handle(handle);
        if gen == 0 {
            return Err(-2);
        }
        let slot = self.slots.get_mut(idx as usize).ok_or(-2)?;
        if slot.generation != gen {
            return Err(-3);
        }
        let state = slot.state.as_mut().ok_or(-3)?;
        f(state)
    }

    pub fn remove(&mut self, handle: u64) -> Result<(), i32> {
        let (idx, gen) = unpack_handle(handle);
        if gen == 0 {
            return Err(-2);
        }
        let slot = self.slots.get_mut(idx as usize).ok_or(-2)?;
        if slot.generation != gen || slot.state.is_none() {
            return Err(-3);
        }
        slot.state = None;
        slot.generation = slot.generation.wrapping_add(1).max(1);
        self.free_list.push(idx);
        Ok(())
    }
}

#[inline]
fn pack_handle(index: u32, generation: u32) -> u64 {
    ((generation as u64) << 32) | (index as u64)
}

#[inline]
fn unpack_handle(handle: u64) -> (u32, u32) {
    let index = (handle & 0xFFFF_FFFF) as u32;
    let generation = (handle >> 32) as u32;
    (index, generation)
}

pub fn global_arena() -> &'static Mutex<HandleArena> {
    static ARENA: OnceLock<Mutex<HandleArena>> = OnceLock::new();
    ARENA.get_or_init(|| Mutex::new(HandleArena::new()))
}

/// Legacy JarvisUltra-Native v4 verifier: H_k = SHA256(R_k || H_{k-1})
#[allow(dead_code)]
pub fn verify_legacy_swift_chain(records: &[&[u8]], expected_head_hex: &str) -> bool {
    let mut head = [0u8; 32];
    for rec in records {
        let mut h = Sha256::new();
        h.update(rec);
        h.update(head);
        head.copy_from_slice(&h.finalize());
    }
    hex::encode(head).eq_ignore_ascii_case(expected_head_hex.trim())
}
