use crate::arena::{global_arena, EngineState};
use crate::core_logic::{append_canonical_record, pack_wg_5field_frame, parse_hex_32, validate_par_artifact};
use std::panic::{catch_unwind, AssertUnwindSafe};

#[repr(C)]
pub struct LiquidOwnedBuf {
    pub ptr: *mut u8,
    pub len: usize,
    pub cap: usize,
    pub status: i32,
}

impl LiquidOwnedBuf {
    fn err(code: i32) -> Self {
        Self {
            ptr: std::ptr::null_mut(),
            len: 0,
            cap: 0,
            status: code,
        }
    }

    fn from_vec(mut data: Vec<u8>, status: i32) -> Self {
        let len = data.len();
        let cap = data.capacity();
        let ptr = data.as_mut_ptr();
        std::mem::forget(data);
        Self { ptr, len, cap, status }
    }
}

fn read_bytes<'a>(ptr: *const u8, len: usize) -> Result<&'a [u8], i32> {
    if len == 0 {
        return Ok(&[]);
    }
    if ptr.is_null() {
        return Err(-1);
    }
    // SAFETY: Caller guarantees [ptr, ptr + len) is valid for read during this FFI call.
    Ok(unsafe { std::slice::from_raw_parts(ptr, len) })
}

#[no_mangle]
pub extern "C" fn liquid_engine_init(
    anchor_hex_ptr: *const u8,
    anchor_hex_len: usize,
    initial_seq: u64,
    out_handle: *mut u64,
) -> i32 {
    let res = catch_unwind(AssertUnwindSafe(|| -> Result<u64, i32> {
        if out_handle.is_null() {
            return Err(-1);
        }
        let anchor_bytes = read_bytes(anchor_hex_ptr, anchor_hex_len)?;
        let anchor_str = std::str::from_utf8(anchor_bytes).map_err(|_| -21)?;
        let prev_hash = parse_hex_32(anchor_str)?;
        let mut arena = global_arena().lock().map_err(|_| -99)?;
        arena.insert(EngineState {
            seq: initial_seq,
            prev_hash,
        })
    }));

    match res {
        Ok(Ok(handle)) => {
            // SAFETY: out_handle null check performed above.
            unsafe { *out_handle = handle };
            0
        }
        Ok(Err(code)) => code,
        Err(_) => -255,
    }
}

#[no_mangle]
pub extern "C" fn liquid_engine_destroy(handle: u64) -> i32 {
    let res = catch_unwind(AssertUnwindSafe(|| -> Result<(), i32> {
        let mut arena = global_arena().lock().map_err(|_| -99)?;
        arena.remove(handle)
    }));
    match res {
        Ok(Ok(())) => 0,
        Ok(Err(code)) => code,
        Err(_) => -255,
    }
}

#[no_mangle]
pub extern "C" fn liquid_audit_append(
    handle: u64,
    payload_ptr: *const u8,
    payload_len: usize,
) -> LiquidOwnedBuf {
    let res = catch_unwind(AssertUnwindSafe(|| -> Result<Vec<u8>, i32> {
        let payload = read_bytes(payload_ptr, payload_len)?;
        let mut arena = global_arena().lock().map_err(|_| -99)?;
        let receipt = arena.with_mut(handle, |st| append_canonical_record(st, payload))?;
        serde_json::to_vec(&receipt).map_err(|_| -40)
    }));

    match res {
        Ok(Ok(bytes)) => LiquidOwnedBuf::from_vec(bytes, 0),
        Ok(Err(code)) => LiquidOwnedBuf::err(code),
        Err(_) => LiquidOwnedBuf::err(-255),
    }
}

#[no_mangle]
pub extern "C" fn liquid_par_validate(json_ptr: *const u8, json_len: usize) -> LiquidOwnedBuf {
    let res = catch_unwind(AssertUnwindSafe(|| -> Result<(Vec<u8>, i32), i32> {
        let raw = read_bytes(json_ptr, json_len)?;
        let result = validate_par_artifact(raw);
        let code = result.exit_code;
        let bytes = serde_json::to_vec(&result).map_err(|_| -40)?;
        Ok((bytes, code))
    }));

    match res {
        Ok(Ok((bytes, exit_code))) => LiquidOwnedBuf::from_vec(bytes, exit_code),
        Ok(Err(code)) => LiquidOwnedBuf::err(code),
        Err(_) => LiquidOwnedBuf::err(-255),
    }
}

#[no_mangle]
pub extern "C" fn liquid_pack_wg_frame(json_ptr: *const u8, json_len: usize) -> LiquidOwnedBuf {
    let res = catch_unwind(AssertUnwindSafe(|| -> Result<Vec<u8>, i32> {
        let raw = read_bytes(json_ptr, json_len)?;
        pack_wg_5field_frame(raw)
    }));

    match res {
        Ok(Ok(bytes)) => LiquidOwnedBuf::from_vec(bytes, 0),
        Ok(Err(code)) => LiquidOwnedBuf::err(code),
        Err(_) => LiquidOwnedBuf::err(-255),
    }
}

#[no_mangle]
pub extern "C" fn liquid_free_buf(buf: LiquidOwnedBuf) {
    let _ = catch_unwind(AssertUnwindSafe(|| {
        if !buf.ptr.is_null() && buf.cap > 0 {
            // SAFETY: Buffer originated from LiquidOwnedBuf::from_vec.
            unsafe {
                drop(Vec::from_raw_parts(buf.ptr, buf.len, buf.cap));
            }
        }
    }));
}
