"use client";

import React, { useEffect, useState } from "react";
import { MapPin, ShieldCheck, Users } from "lucide-react";
import { DEMO_LOCATION_PRESETS } from "@/lib/types";

interface NearbyVol {
  _id: string;
  displayName: string;
  registeredArea: string;
  verificationStatus: string;
  alertEligible: boolean;
  telegramLinked: boolean;
  distanceMeters: number;
  approxDistanceText: string;
  isSimulatedDemo: boolean;
}

export function OperatorLocationsClient() {
  const [presetId, setPresetId] = useState(DEMO_LOCATION_PRESETS[0].id);
  const [maxDistance, setMaxDistance] = useState(5000);
  const [volunteers, setVolunteers] = useState<NearbyVol[]>([]);
  const [excludedCount, setExcludedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const selectedPreset =
    DEMO_LOCATION_PRESETS.find((p) => p.id === presetId) ||
    DEMO_LOCATION_PRESETS[0];

  useEffect(() => {
    let active = true;
    fetch(
      `/api/volunteers/nearby?lng=${selectedPreset.lng}&lat=${selectedPreset.lat}&maxDistance=${maxDistance}`,
      { cache: "no-store" }
    )
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        setVolunteers(d.eligibleVolunteers || []);
        setExcludedCount(d.excludedUnverifiedCount || 0);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedPreset.lng, selectedPreset.lat, maxDistance]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-xl font-semibold text-[#2B1324]">
          Location &amp; Geospatial Volunteer Selection
        </h2>
        <p className="mt-1 text-sm text-[#7A566E]">
          Switch the incident zone and observe how MongoDB{" "}
          <code className="rounded bg-[#FCE7F3] px-1 text-[#2B1324]">
            2dsphere
          </code>{" "}
          updates eligible verified volunteers based on registered usual areas.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-[#F3D5E5] bg-white p-5 space-y-4 lg:col-span-5">
          <h3 className="font-heading text-base font-semibold flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#DB2777]" />
            Select Demonstration Incident Zone
          </h3>

          <div className="space-y-2">
            {DEMO_LOCATION_PRESETS.map((p) => {
              const active = p.id === presetId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPresetId(p.id)}
                  className={`w-full rounded-lg border p-3.5 text-left transition cursor-pointer ${
                    active
                      ? "border-[#D946A8] bg-[#FCE7F3]"
                      : "border-[#F3D5E5] bg-[#FFF7FA] hover:border-[#DB2777]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-[#2B1324]">
                      {p.areaName}
                    </span>
                    <span className="font-mono text-[11px] text-[#DB2777] tabular-nums">
                      {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-[#7A566E]">
                    {p.approxLabel}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="pt-2">
            <label className="mb-1 block text-xs font-medium text-[#7A566E]">
              Geospatial Search Radius: {(maxDistance / 1000).toFixed(1)} km
            </label>
            <input
              type="range"
              min={1000}
              max={15000}
              step={1000}
              value={maxDistance}
              onChange={(e) => setMaxDistance(Number(e.target.value))}
              className="w-full accent-[#D946A8]"
            />
          </div>
        </div>

        <div className="rounded-xl border border-[#F3D5E5] bg-white p-5 space-y-4 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-heading text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-[#DB2777]" />
                Eligible Recipients near {selectedPreset.areaName}
              </h3>
              <p className="text-xs text-[#7A566E]">
                {excludedCount} unverified/ineligible record(s) excluded by
                server policy.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              {volunteers.length} Eligible
            </span>
          </div>

          {loading ? (
            <p className="text-xs text-[#7A566E]">
              Querying geospatial volunteer records…
            </p>
          ) : volunteers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#F3D5E5] p-6 text-center text-xs text-[#7A566E]">
              No verified volunteers registered within{" "}
              {(maxDistance / 1000).toFixed(1)} km of {selectedPreset.areaName}.
            </div>
          ) : (
            <div className="space-y-2.5">
              {volunteers.map((v) => (
                <div
                  key={v._id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#F3D5E5] bg-[#FFF7FA] p-4"
                >
                  <div>
                    <div className="font-semibold text-sm text-[#2B1324]">
                      {v.displayName}
                    </div>
                    <div className="text-xs text-[#7A566E]">
                      Registered Area: {v.registeredArea}
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-medium text-emerald-700">
                        {v.verificationStatus}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-medium ${
                          v.telegramLinked
                            ? "bg-[#FCE7F3] text-[#2B1324]"
                            : "bg-[#FCE7F3] text-[#7A566E]"
                        }`}
                      >
                        {v.telegramLinked
                          ? "Telegram Ready"
                          : "Telegram Not Linked"}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-bold text-[#DB2777] tabular-nums">
                      {v.approxDistanceText}
                    </div>
                    <div className="text-[11px] text-[#7A566E]">
                      Approximate distance
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
