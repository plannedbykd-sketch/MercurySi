use crate::arena::{global_arena, EngineState};
use crate::core_logic::{append_canonical_record, pack_wg_5field_frame, parse_hex_32, validate_par_artifact};
use jni::objects::{JByteArray, JByteBuffer, JClass, JString};
use jni::sys::{jbyteArray, jint, jlong, jstring};
use jni::JNIEnv;
use std::panic::{catch_unwind, AssertUnwindSafe};

#[no_mangle]
pub extern "system" fn Java_com_liquidos_kernel_LiquidKernelBridge_nativeInit<'local>(
    mut env: JNIEnv<'local>,
    _class: JClass<'local>,
    anchor_hex: JString<'local>,
    initial_seq: jlong,
) -> jlong {
    let res = catch_unwind(AssertUnwindSafe(|| -> Result<jlong, i32> {
        let jstr = env.get_string(&anchor_hex).map_err(|_| -1)?;
        let hex_str = jstr.to_str().map_err(|_| -21)?;
        let prev_hash = parse_hex_32(hex_str)?;
        let seq = u64::try_from(initial_seq).map_err(|_| -22)?;
        let mut arena = global_arena().lock().map_err(|_| -99)?;
        let handle = arena.insert(EngineState { seq, prev_hash })?;
        Ok(handle as jlong)
    }));

    match res {
        Ok(Ok(h)) => h,
        Ok(Err(code)) => code as jlong,
        Err(_) => -255,
    }
}

#[no_mangle]
pub extern "system" fn Java_com_liquidos_kernel_LiquidKernelBridge_nativeDestroy<'local>(
    _env: JNIEnv<'local>,
    _class: JClass<'local>,
    handle: jlong,
) -> jint {
    let res = catch_unwind(AssertUnwindSafe(|| -> Result<(), i32> {
        let mut arena = global_arena().lock().map_err(|_| -99)?;
        arena.remove(handle as u64)
    }));
    match res {
        Ok(Ok(())) => 0,
        Ok(Err(code)) => code,
        Err(_) => -255,
    }
}

#[no_mangle]
pub extern "system" fn Java_com_liquidos_kernel_LiquidKernelBridge_nativeAuditAppendDirect<'local>(
    env: JNIEnv<'local>,
    _class: JClass<'local>,
    handle: jlong,
    direct_buf: JByteBuffer<'local>,
    len: jint,
) -> jstring {
    let res = catch_unwind(AssertUnwindSafe(|| -> Result<String, i32> {
        let ulen = usize::try_from(len).map_err(|_| -1)?;
        let ptr = env.get_direct_buffer_address(&direct_buf).map_err(|_| -1)?;
        let cap = env.get_direct_buffer_capacity(&direct_buf).map_err(|_| -1)?;
        if ulen > cap {
            return Err(-2);
        }
        // SAFETY: JNI guarantees DirectByteBuffer backing memory remains valid for this call.
        let payload = if ulen == 0 {
            &[]
        } else {
            unsafe { std::slice::from_raw_parts(ptr, ulen) }
        };
        let mut arena = global_arena().lock().map_err(|_| -99)?;
        let receipt = arena.with_mut(handle as u64, |st| append_canonical_record(st, payload))?;
        serde_json::to_string(&receipt).map_err(|_| -40)
    }));

    match res {
        Ok(Ok(json)) => env.new_string(json).map(|s| s.into_raw()).unwrap_or(std::ptr::null_mut()),
        _ => std::ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "system" fn Java_com_liquidos_kernel_LiquidKernelBridge_nativeValidatePar<'local>(
    env: JNIEnv<'local>,
    _class: JClass<'local>,
    json_bytes: JByteArray<'local>,
) -> jstring {
    let res = catch_unwind(AssertUnwindSafe(|| -> Result<String, i32> {
        let bytes = env.convert_byte_array(&json_bytes).map_err(|_| -1)?;
        let result = validate_par_artifact(&bytes);
        serde_json::to_string(&result).map_err(|_| -40)
    }));

    match res {
        Ok(Ok(json)) => env.new_string(json).map(|s| s.into_raw()).unwrap_or(std::ptr::null_mut()),
        _ => std::ptr::null_mut(),
    }
}

#[no_mangle]
pub extern "system" fn Java_com_liquidos_kernel_LiquidKernelBridge_nativePackWgFrame<'local>(
    env: JNIEnv<'local>,
    _class: JClass<'local>,
    json_bytes: JByteArray<'local>,
) -> jbyteArray {
    let res = catch_unwind(AssertUnwindSafe(|| -> Result<Vec<u8>, i32> {
        let bytes = env.convert_byte_array(&json_bytes).map_err(|_| -1)?;
        pack_wg_5field_frame(&bytes)
    }));

    match res {
        Ok(Ok(frame)) => env.byte_array_from_slice(&frame).map(|a| a.into_raw()).unwrap_or(std::ptr::null_mut()),
        _ => std::ptr::null_mut(),
    }
}
