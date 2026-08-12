import { useState } from "react";
import FormField from "./FormField";
import Input from "./Input";
import Button from "./Button";

// Shared by every OTP-code entry point (signup verification, existing-user
// reverification, forgot-password) — one place to keep the digit-count and
// styling consistent instead of three bespoke forms.
//
// 8 digits, not the conventional 6: supabase/config.toml's
// [auth.email] otp_length is set to 8, and there's no way to read that
// value from the app at runtime, so it's hardcoded here to match.
const CODE_LENGTH = 8;

export default function OtpCodeInput({ email, onSubmit, submitting, onResend, resending, error, sentLabel }) {
  const [code, setCode] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = code.trim();
    if (trimmed.length !== CODE_LENGTH) return;
    onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-md border border-border bg-surface px-3.5 py-3">
      <p className="text-xs text-ink-tertiary">
        {sentLabel || (
          <>
            Or enter the {CODE_LENGTH}-digit code we sent to{" "}
            <span className="font-medium text-ink-secondary">{email}</span>.
          </>
        )}
      </p>
      <FormField error={error}>
        <Input
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          placeholder={"0".repeat(CODE_LENGTH)}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
          error={!!error}
        />
      </FormField>
      <div className="flex gap-2">
        <Button type="submit" size="sm" loading={submitting} disabled={code.trim().length !== CODE_LENGTH}>
          Verify code
        </Button>
        {onResend && (
          <Button type="button" size="sm" variant="secondary" loading={resending} onClick={onResend}>
            Resend
          </Button>
        )}
      </div>
    </form>
  );
}
