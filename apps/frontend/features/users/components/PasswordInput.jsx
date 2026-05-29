"use client";
// Input password dengan tombol show/hide.

import { useState } from "react";
import { Input } from "@/components/ui";
import { EyeOpenIcon, EyeSlashIcon } from "./icons";

export function PasswordInput({ label, value, onChange }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        label={label}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
      />
      <button
        type="button"
        onClick={() => setShow((p) => !p)}
        className="absolute right-3 top-[34px] text-slate-400 hover:text-slate-600"
        tabIndex={-1}
      >
        {show ? <EyeOpenIcon /> : <EyeSlashIcon />}
      </button>
    </div>
  );
}
