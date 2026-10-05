"use client";

import { useCallback, useEffect, useState } from "react";

interface OrganizationBranding {
  name: string;
  logo: string;
}

interface OrganizationBrandProps {
  tokenKey: string;
  userStorageKey: string;
  portalLabel: string;
  fallbackName?: string;
}

function readSavedBranding(
  userStorageKey: string,
  fallbackName: string
): OrganizationBranding {
  if (typeof window === "undefined") {
    return {
      name: fallbackName,
      logo: "",
    };
  }

  try {
    const saved = JSON.parse(
      localStorage.getItem(userStorageKey) || "{}"
    );

    return {
      name: saved.organization || fallbackName,
      logo: saved.organization_logo || "",
    };
  } catch {
    return {
      name: fallbackName,
      logo: "",
    };
  }
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "LMS"
  );
}

export default function OrganizationBrand({
  tokenKey,
  userStorageKey,
  portalLabel,
  fallbackName = "Shabdd LMS",
}: OrganizationBrandProps) {
  const [branding, setBranding] = useState<OrganizationBranding>(() =>
    readSavedBranding(userStorageKey, fallbackName)
  );

  const loadBranding = useCallback(async () => {
    const token = localStorage.getItem(tokenKey);

    if (!token) {
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/accounts/organization-branding/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      if (!response.ok) {
        return;
      }

      const result = await response.json();

      const nextBranding = {
        name: result.name || fallbackName,
        logo: result.logo || "",
      };

      setBranding(nextBranding);

      try {
        const saved = JSON.parse(
          localStorage.getItem(userStorageKey) || "{}"
        );

        localStorage.setItem(
          userStorageKey,
          JSON.stringify({
            ...saved,
            organization: nextBranding.name,
            organization_logo: nextBranding.logo,
            organization_code:
              result.code || saved.organization_code || "",
          })
        );
      } catch {
        // Keep branding visible even if local storage cannot be updated.
      }
    } catch {
      // Keep cached branding when the network is temporarily unavailable.
    }
  }, [fallbackName, tokenKey, userStorageKey]);

  useEffect(() => {
    void loadBranding();

    const handleOrganizationUpdated = () => {
      void loadBranding();
    };

    window.addEventListener(
      "lms:organization-updated",
      handleOrganizationUpdated
    );

    return () => {
      window.removeEventListener(
        "lms:organization-updated",
        handleOrganizationUpdated
      );
    };
  }, [loadBranding]);

  return (
    <div
      className="portal-organization-brand"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        minWidth: 0,
      }}
    >
      {branding.logo ? (
        <img
          src={branding.logo}
          alt={`${branding.name} logo`}
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "10px",
            border: "1px solid #e5e7eb",
            background: "#fff",
            objectFit: "contain",
            padding: "4px",
            flex: "0 0 auto",
          }}
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <span
          aria-hidden="true"
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "10px",
            border: "1px solid #e5e7eb",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#fff",
            fontWeight: 700,
            fontSize: "13px",
            flex: "0 0 auto",
          }}
        >
          {initials(branding.name)}
        </span>
      )}

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: "16px",
            lineHeight: 1.2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={branding.name}
        >
          {branding.name}
        </div>
        <small
          style={{
            display: "block",
            marginTop: "3px",
            color: "#7b8794",
          }}
        >
          {portalLabel}
        </small>
      </div>
    </div>
  );
}
