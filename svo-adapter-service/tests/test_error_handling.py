from app.error_handling import safe_error_message


def test_safe_error_message_redacts_headers_bearer_tokens_and_signed_urls():
    value = (
        "Authorization: Bearer abc.def.ghi; "
        "X-Tapis-Token=secret-token; "
        "https://example.test/result?X-Amz-Signature=private-signature&value=ok; "
        "eyJabcdefghijklmnopqr.abcdefghijk.abcdefghijklmnop"
    )

    message = safe_error_message(value)

    assert "abc.def.ghi" not in message
    assert "secret-token" not in message
    assert "private-signature" not in message
    assert "eyJabcdefghijklmnopqr" not in message
    assert "Authorization: [REDACTED]" in message
    assert "X-Amz-Signature=[REDACTED]" in message


def test_safe_error_message_is_single_line_and_bounded():
    message = safe_error_message("first\nsecond\r\n" + "x" * 3000)

    assert "\n" not in message
    assert "\r" not in message
    assert len(message) == 2000
