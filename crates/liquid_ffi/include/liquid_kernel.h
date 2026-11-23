#ifndef LIQUID_KERNEL_H
#define LIQUID_KERNEL_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
    uint8_t *ptr;
    size_t len;
    size_t cap;
    int32_t status;
} LiquidOwnedBuf;

int32_t liquid_engine_init(const uint8_t *anchor_hex_ptr, size_t anchor_hex_len, uint64_t initial_seq, uint64_t *out_handle);
int32_t liquid_engine_destroy(uint64_t handle);
LiquidOwnedBuf liquid_audit_append(uint64_t handle, const uint8_t *payload_ptr, size_t payload_len);
LiquidOwnedBuf liquid_par_validate(const uint8_t *json_ptr, size_t json_len);
LiquidOwnedBuf liquid_pack_wg_frame(const uint8_t *json_ptr, size_t json_len);
void liquid_free_buf(LiquidOwnedBuf buf);

#ifdef __cplusplus
}
#endif
#endif
