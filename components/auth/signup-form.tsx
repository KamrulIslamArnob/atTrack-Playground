"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

type ValidationErrors = Record<string, string>;

function useDebouncedValidation(delay = 400) {
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const validate = useCallback(
    (name: string, value: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        setErrors((prev) => {
          const next = { ...prev };

          switch (name) {
            case "full_name":
              if (!value.trim()) {
                next.full_name = "Full name is required";
              } else {
                delete next.full_name;
              }
              break;
            case "email":
              if (!value.trim()) {
                next.email = "Email is required";
              } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                next.email = "Enter a valid email address";
              } else {
                delete next.email;
              }
              break;
            case "password":
              if (!value) {
                next.password = "Password is required";
              } else if (value.length < 6) {
                next.password = "Password must be at least 6 characters";
              } else {
                delete next.password;
              }
              break;
            case "website":
              if (value && !/^https?:\/\/.+\..+/.test(value)) {
                next.website = "Enter a valid URL";
              } else {
                delete next.website;
              }
              break;
          }

          return next;
        });
      }, delay);
    },
    [delay]
  );

  const markTouched = useCallback((name: string) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
  }, []);

  const getFieldError = useCallback(
    (name: string) => {
      return touched[name] ? errors[name] : undefined;
    },
    [touched, errors]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { errors, touched, validate, markTouched, getFieldError };
}

export function SignupForm() {
  const [pending, setPending] = useState(false);
  const { validate, markTouched, getFieldError } = useDebouncedValidation();
  const formRef = useRef<HTMLFormElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const formData = new FormData(formRef.current!);
    const allValues: Record<string, string> = {};
    formData.forEach((v, k) => {
      allValues[k] = v as string;
    });
    allValues[name] = value;
    validate(name, value);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    markTouched(name);
    validate(name, value);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const formData = new FormData(formRef.current!);
    const allValues: Record<string, string> = {};
    formData.forEach((v, k) => {
      allValues[k] = v as string;
    });

    // Validate all fields immediately
    validate("full_name", allValues.full_name ?? "");
    validate("email", allValues.email ?? "");
    validate("password", allValues.password ?? "");
    validate("website", allValues.website ?? "");

    // Check if there are errors
    const hasErrors =
      !allValues.full_name?.trim() ||
      !allValues.email?.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(allValues.email ?? "") ||
      !allValues.password ||
      allValues.password.length < 6 ||
      (allValues.website && !/^https?:\/\/.+\..+/.test(allValues.website));

    if (hasErrors) {
      e.preventDefault();
      return;
    }

    setPending(true);
  };

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        const { signUp } = await import("@/lib/actions/auth");
        await signUp(formData);
      }}
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      <div className="space-y-2">
        <Label htmlFor="full_name">Full name *</Label>
        <Input
          id="full_name"
          name="full_name"
          placeholder="e.g. Sarah Chen"
          required
          disabled={pending}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={!!getFieldError("full_name")}
        />
        {getFieldError("full_name") && (
          <p className="text-xs text-destructive">{getFieldError("full_name")}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="headline">Professional headline</Label>
        <Input
          id="headline"
          name="headline"
          placeholder="e.g. Senior Frontend Engineer"
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email *</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          required
          disabled={pending}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={!!getFieldError("email")}
        />
        {getFieldError("email") && (
          <p className="text-xs text-destructive">{getFieldError("email")}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password *</Label>
        <Input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          disabled={pending}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={!!getFieldError("password")}
        />
        {getFieldError("password") && (
          <p className="text-xs text-destructive">{getFieldError("password")}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            name="location"
            placeholder="e.g. San Francisco, CA"
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="e.g. +1 555 0123"
            disabled={pending}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="website">Website</Label>
        <Input
          id="website"
          name="website"
          type="url"
          placeholder="https://yoursite.com"
          disabled={pending}
          onChange={handleChange}
          onBlur={handleBlur}
          aria-invalid={!!getFieldError("website")}
        />
        {getFieldError("website") && (
          <p className="text-xs text-destructive">{getFieldError("website")}</p>
        )}
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? <Spinner className="mr-2" /> : null}
        Create account
      </Button>
    </form>
  );
}
