package com.liquidos.kernel

import java.nio.ByteBuffer

object LiquidKernelBridge {
    init {
        System.loadLibrary("liquid_kernel")
    }

    @JvmStatic
    external fun nativeInit(anchorHex: String, initialSeq: Long): Long

    @JvmStatic
    external fun nativeDestroy(handle: Long): Int

    @JvmStatic
    external fun nativeAuditAppendDirect(handle: Long, directBuf: ByteBuffer, len: Int): String?

    @JvmStatic
    external fun nativeValidatePar(jsonBytes: ByteArray): String?

    @JvmStatic
    external fun nativePackWgFrame(jsonBytes: ByteArray): ByteArray?

    fun appendCanonicalRecord(handle: Long, payload: ByteArray): String {
        val direct = ByteBuffer.allocateDirect(payload.size)
        direct.put(payload)
        direct.flip()
        return nativeAuditAppendDirect(handle, direct, payload.size)
            ?: error("nativeAuditAppendDirect failed for handle=$handle")
    }
}
