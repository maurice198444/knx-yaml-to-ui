"""ULID generation in Crockford Base32 — 48-bit time + 80-bit random, 26 chars total."""
import secrets
import time

CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


def _encode_b32(value: int, length: int) -> str:
    chars: list[str] = []
    for _ in range(length):
        chars.append(CROCKFORD[value & 0x1F])
        value >>= 5
    return "".join(reversed(chars))


def gen_ulid() -> str:
    """Generate a 26-character Crockford-Base32 ULID.

    Format: 10 chars timestamp (ms since epoch) + 16 chars randomness.
    """
    time_ms = int(time.time() * 1000)
    rand_80 = secrets.randbits(80)
    return _encode_b32(time_ms, 10) + _encode_b32(rand_80, 16)
