"use client";

import { useState } from "react";

interface PasswordFieldProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  className?: string;
}

export default function PasswordField({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  required = true,
  className = "",
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={className}>
      <label htmlFor={id} className="form-label">
        {label}
      </label>

      <div className="input-group">
        <input
          id={id}
          type={visible ? "text" : "password"}
          className="form-control"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
        />

        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}
