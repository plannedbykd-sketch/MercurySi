import Foundation
import CLiquidKernel

public enum LiquidKernelError: Error {
    case initFailed(Int32)
    case runtimeFailed(Int32)
    case invalidUtf8
}

public final class LiquidKernelEngine {
    private var handle: UInt64 = 0

    public init(anchorHex: String = "", initialSeq: UInt64 = 0) throws {
        var outHandle: UInt64 = 0
        let anchorData = Data(anchorHex.utf8)
        let rc: Int32 = anchorData.withUnsafeBytes { rawBuf in
            let ptr = rawBuf.bindMemory(to: UInt8.self).baseAddress
            return liquid_engine_init(ptr, anchorData.count, initialSeq, &outHandle)
        }
        guard rc == 0 else { throw LiquidKernelError.initFailed(rc) }
        self.handle = outHandle
    }

    deinit {
        if handle != 0 {
            _ = liquid_engine_destroy(handle)
            handle = 0
        }
    }

    public func appendCanonicalRecord(_ payload: Data) throws -> Data {
        let buf: LiquidOwnedBuf = payload.withUnsafeBytes { rawBuf in
            let ptr = rawBuf.bindMemory(to: UInt8.self).baseAddress
            return liquid_audit_append(handle, ptr, payload.count)
        }
        defer { liquid_free_buf(buf) }
        guard buf.status == 0, let ptr = buf.ptr else {
            throw LiquidKernelError.runtimeFailed(buf.status)
        }
        return Data(bytes: ptr, count: buf.len)
    }

    public static func validateParArtifact(_ jsonData: Data) throws -> (exitCode: Int32, json: Data) {
        let buf: LiquidOwnedBuf = jsonData.withUnsafeBytes { rawBuf in
            let ptr = rawBuf.bindMemory(to: UInt8.self).baseAddress
            return liquid_par_validate(ptr, jsonData.count)
        }
        defer { liquid_free_buf(buf) }
        guard let ptr = buf.ptr, buf.status >= 0 else {
            throw LiquidKernelError.runtimeFailed(buf.status)
        }
        return (buf.status, Data(bytes: ptr, count: buf.len))
    }

    public static func packWireGuardFrame(_ jsonData: Data) throws -> Data {
        let buf: LiquidOwnedBuf = jsonData.withUnsafeBytes { rawBuf in
            let ptr = rawBuf.bindMemory(to: UInt8.self).baseAddress
            return liquid_pack_wg_frame(ptr, jsonData.count)
        }
        defer { liquid_free_buf(buf) }
        guard buf.status == 0, let ptr = buf.ptr else {
            throw LiquidKernelError.runtimeFailed(buf.status)
        }
        return Data(bytes: ptr, count: buf.len)
    }
}
