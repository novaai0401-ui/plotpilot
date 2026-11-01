"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { csrfFetch } from "@/lib/security/csrf-fetch";
import { useRouter } from "next/navigation";
import {
  TkxStepper,
  TkxButton,
  TkxInput,
  TkxSelect,
  TkxNumberInput,
  TkxCheckbox,
  TkxAlert,
  TkxCard,
  TkxCardHeader,
  TkxCardBody,
  TkxBadge,
  useToast,
  type SelectOption,
} from "@/components/tkx-dyn";
import { UpgradeModal, type CapInfo } from "@/components/billing/upgrade-modal";
import { useLocale, useT } from "@/lib/i18n/client";
import { formatNumber } from "@/lib/i18n/format";

type WizardProps = {
  source: "broker" | "client" | "public_lead" | "standalone";
  plotId?: string;
  defaultPlotSqft?: number;
  onComplete?: (designId: string) => void;
};

const PROJECT_TYPES = [
  "residential_house", "residential_apartment", "commercial_office", "commercial_retail", "mixed_use",
];
const FACINGS = ["N", "E", "S", "W", "NE", "NW", "SE", "SW"];
const STYLES = [
  "modern", "contemporary", "traditional", "minimalist", "industrial", "mediterranean", "colonial",
];
const CLIMATES = ["tropical", "temperate", "arid", "cold", "humid"];

export function RequirementsWizard({ source, plotId, defaultPlotSqft, onComplete }: WizardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const t = useT();
  const locale = useLocale();
  const [activeStep, setActiveStep] = useState(0);

  const { STEPS, PROJECT_TYPE_OPTIONS, FACING_OPTIONS, STYLE_OPTIONS, CLIMATE_OPTIONS } = useMemo(() => {
    const options = (values: string[], prefix: string): SelectOption[] =>
      values.map((value) => ({ value, label: t(`${prefix}.${value}`) }));
    return {
      STEPS: [
        // No "&" in any language: TkxStepper escapes it and shows a literal "&amp;".
        { id: "project", title: t("design.wizard.step.project.title"), description: t("design.wizard.step.project.desc") },
        { id: "plot", title: t("common.plot"), description: t("design.wizard.step.plot.desc") },
        { id: "layout", title: t("design.wizard.step.layout.title"), description: t("design.wizard.step.layout.desc") },
        { id: "amenities", title: t("design.wizard.step.amenities.title"), description: t("design.wizard.step.amenities.desc") },
        { id: "style", title: t("design.wizard.step.style.title"), description: t("design.wizard.step.style.desc") },
        { id: "review", title: t("design.wizard.step.review.title"), description: t("design.wizard.step.review.desc") },
      ],
      PROJECT_TYPE_OPTIONS: options(PROJECT_TYPES, "design.projectType"),
      FACING_OPTIONS: options(FACINGS, "design.facing"),
      STYLE_OPTIONS: options(STYLES, "design.style"),
      CLIMATE_OPTIONS: options(CLIMATES, "design.climate"),
    };
  }, [t]);

  // Form state
  const [projectType, setProjectType] = useState("residential_house");
  const [totalSqft, setTotalSqft] = useState<number>(defaultPlotSqft || 2400);
  const [frontageFt, setFrontageFt] = useState<number | null>(null);
  const [depthFt, setDepthFt] = useState<number | null>(null);
  const [facing, setFacing] = useState("E");
  const [maxFAR, setMaxFAR] = useState(2.0);
  const [setbackFront, setSetbackFront] = useState(5);
  const [setbackRear, setSetbackRear] = useState(3);
  const [setbackSide, setSetbackSide] = useState(3);
  const [floors, setFloors] = useState(2);
  const [unitsPerFloor, setUnitsPerFloor] = useState(1);
  const [bedrooms, setBedrooms] = useState(3);
  const [bathrooms, setBathrooms] = useState(2);
  const [livingRooms, setLivingRooms] = useState(1);
  const [poojaRooms, setPoojaRooms] = useState(0);
  const [studyRooms, setStudyRooms] = useState(0);
  const [workstations, setWorkstations] = useState(0);
  const [cabins, setCabins] = useState(0);
  const [meetingRooms, setMeetingRooms] = useState(0);
  const [cafeteria, setCafeteria] = useState(false);
  const [retailUnits, setRetailUnits] = useState(0);
  const [cars, setCars] = useState(2);
  const [bikes, setBikes] = useState(2);
  const [balcony, setBalcony] = useState(true);
  const [terrace, setTerrace] = useState(true);
  const [garden, setGarden] = useState(false);
  const [lift, setLift] = useState(false);
  const [solar, setSolar] = useState(false);
  const [rainwater, setRainwater] = useState(false);
  const [style, setStyle] = useState("modern");
  const [climate, setClimate] = useState("tropical");
  const [vastuCompliant, setVastuCompliant] = useState(false);
  const [accessibility, setAccessibility] = useState(false);
  const [sustainable, setSustainable] = useState(false);
  const [notes, setNotes] = useState("");
  // Public lead capture
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadCity, setLeadCity] = useState("");
  const [leadCoords, setLeadCoords] = useState<{ lat: number; lng: number } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [capInfo, setCapInfo] = useState<CapInfo | null>(null);

  // Focus the panel heading whenever the step changes so keyboard users land
  // on the new content instead of staying on the Next button. Aria-live region
  // below the heading announces the transition for screen readers.
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    stepHeadingRef.current?.focus();
  }, [activeStep]);

  const isCommercial = projectType.startsWith("commercial");
  const isMixed = projectType === "mixed_use";

  const requirements = useMemo(
    () => ({
      projectType,
      plot: {
        totalSqft,
        frontageFt: frontageFt ?? undefined,
        depthFt: depthFt ?? undefined,
        facing,
        setbackFrontFt: setbackFront,
        setbackRearFt: setbackRear,
        setbackSideFt: setbackSide,
        maxFAR,
        maxHeightFt: 45,
      },
      floors,
      unitsPerFloor,
      rooms: {
        bedrooms,
        bathrooms,
        kitchens: 1,
        livingRooms,
        diningRooms: 1,
        studyRooms,
        poojaRooms,
        utilityRooms: 1,
        servantRooms: 0,
      },
      commercial: {
        workstations,
        cabins,
        meetingRooms,
        reception: isCommercial || isMixed,
        cafeteria,
        retailUnits,
      },
      parking: { cars, bikes, basement: false },
      amenities: { balcony, terrace, garden, lift, solar, rainwater, pool: false, gym: false },
      preferences: { style, climate, vastuCompliant, accessibility, sustainable },
      budget: {},
      notes: notes || undefined,
    }),
    [
      projectType, totalSqft, frontageFt, depthFt, facing, maxFAR,
      setbackFront, setbackRear, setbackSide, floors, unitsPerFloor,
      bedrooms, bathrooms, livingRooms, poojaRooms, studyRooms,
      workstations, cabins, meetingRooms, cafeteria, retailUnits,
      cars, bikes, balcony, terrace, garden, lift, solar, rainwater,
      style, climate, vastuCompliant, accessibility, sustainable, notes,
      isCommercial, isMixed,
    ]
  );

  async function onSubmit() {
    setSubmitting(true);
    try {
      const res = await csrfFetch("/api/architect/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirements,
          plotId,
          source,
          lead: source === "public_lead"
            ? { name: leadName, phone: leadPhone, email: leadEmail, city: leadCity }
            : undefined,
          leadCity: leadCity || undefined,
          leadLat: leadCoords?.lat,
          leadLng: leadCoords?.lng,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        if (res.status === 402 && j.cap) {
          setCapInfo(j.cap);
          return;
        }
        throw new Error(j.error || t("design.wizard.failed"));
      }
      toast({ title: t("design.wizard.generated"), variant: "success" });
      if (onComplete) return onComplete(j.id);
      router.push(`/designs/${j.id}`);
    } catch (e: any) {
      toast({ title: t("design.wizard.failed"), description: e.message, variant: "danger" });
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = source !== "public_lead" || (leadName.trim() !== "" && leadPhone.trim() !== "");

  return (
    <>
      <UpgradeModal open={capInfo !== null} onClose={() => setCapInfo(null)} cap={capInfo} />

      <TkxCard variant="elevated" padding="lg">
        <TkxCardHeader title={t("design.wizard.title")} subtitle={t("design.wizard.subtitle")} />
        <TkxCardBody>
          {/*
            Keyboard story:
              - `<form>` with onSubmit so Enter inside any field advances steps
                (or triggers Generate on the last step) — the same UX a single-
                page form gives.
              - Back/Next are explicitly type="button" so Enter never hits them.
              - Generate is type="submit", honored only when activeStep === last.
              - stepHeadingRef catches focus on every step change (useEffect above).
          */}
          <form
            noValidate
            aria-label={t("design.wizard.formLabel")}
            onSubmit={(e) => {
              e.preventDefault();
              if (activeStep < STEPS.length - 1) {
                setActiveStep((s) => s + 1);
              } else if (canSubmit && !submitting) {
                onSubmit();
              }
            }}
          >
          {/* Step descriptions are shown below, for the current step only: all six
              overlap once translated or on a phone. Narrow screens scroll sideways. */}
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 520 }}>
              <TkxStepper
                steps={STEPS.map((s, i) => ({
                  id: s.id,
                  title: s.title,
                  status: i < activeStep ? "completed" : i === activeStep ? "active" : "pending",
                }))}
                activeStep={activeStep}
                clickable
                onStepClick={(i) => setActiveStep(i)}
                variant="default"
                connector="solid"
                size="md"
              />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">{STEPS[activeStep].description}</p>

          {/* Hidden focus target + live region. The heading is sr-only but
              focusable (tabIndex=-1) so the focus ring isn't visible. The
              second div announces step transitions to screen readers. */}
          <h2
            ref={stepHeadingRef}
            tabIndex={-1}
            className="sr-only"
            aria-live="polite"
          >
            {t("design.wizard.stepHeading", {
              current: activeStep + 1,
              total: STEPS.length,
              title: STEPS[activeStep].title,
              description: STEPS[activeStep].description,
            })}
          </h2>

          <div
            role="group"
            aria-labelledby="wizard-step-region"
            style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16 }}
          >
            {/* STEP 0 — Project type */}
            {activeStep === 0 && (
              <TkxSelect
                label={t("design.wizard.projectType")}
                options={PROJECT_TYPE_OPTIONS}
                value={projectType}
                onChange={(v) => setProjectType(v as string)}
              />
            )}

            {/* STEP 1 — Plot */}
            {activeStep === 1 && (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <TkxNumberInput
                    label={t("design.wizard.totalArea")}
                    value={totalSqft}
                    onChange={(v) => setTotalSqft(v ?? 0)}
                    min={200}
                    max={500_000}
                    suffix={` ${t("design.sqft")}`}
                  />
                  <TkxSelect
                    label={t("design.wizard.facing")}
                    options={FACING_OPTIONS}
                    value={facing}
                    onChange={(v) => setFacing(v as string)}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <TkxNumberInput
                    label={t("design.wizard.frontage")}
                    value={frontageFt ?? undefined}
                    onChange={(v) => setFrontageFt(v)}
                    min={10}
                    max={2000}
                  />
                  <TkxNumberInput
                    label={t("design.wizard.depth")}
                    value={depthFt ?? undefined}
                    onChange={(v) => setDepthFt(v)}
                    min={10}
                    max={2000}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                  <TkxNumberInput label={t("design.wizard.farCap")} value={maxFAR} onChange={(v) => setMaxFAR(v ?? 2)} step={0.1} min={0.5} max={10} precision={1} />
                  <TkxNumberInput label={t("design.wizard.setbackFront")} value={setbackFront} onChange={(v) => setSetbackFront(v ?? 5)} min={0} max={50} />
                  <TkxNumberInput label={t("design.wizard.setbackRear")} value={setbackRear} onChange={(v) => setSetbackRear(v ?? 3)} min={0} max={50} />
                  <TkxNumberInput label={t("design.wizard.setbackSide")} value={setbackSide} onChange={(v) => setSetbackSide(v ?? 3)} min={0} max={50} />
                </div>
              </div>
            )}

            {/* STEP 2 — Layout */}
            {activeStep === 2 && (
              <div style={{ display: "grid", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <TkxNumberInput label={t("design.wizard.floors")} value={floors} onChange={(v) => setFloors(v ?? 1)} min={1} max={50} />
                  {projectType === "residential_apartment" && (
                    <TkxNumberInput label={t("design.wizard.unitsPerFloor")} value={unitsPerFloor} onChange={(v) => setUnitsPerFloor(v ?? 1)} min={1} max={50} />
                  )}
                </div>

                {!isCommercial && (
                  <div>
                    <SectionTitle>{t("design.wizard.residentialRooms")} {projectType === "residential_apartment" ? t("design.wizard.perUnit") : ""}</SectionTitle>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                      <TkxNumberInput label={t("design.wizard.bedrooms")} value={bedrooms} onChange={(v) => setBedrooms(v ?? 0)} min={0} max={10} />
                      <TkxNumberInput label={t("design.wizard.bathrooms")} value={bathrooms} onChange={(v) => setBathrooms(v ?? 0)} min={0} max={10} />
                      <TkxNumberInput label={t("design.wizard.livingRooms")} value={livingRooms} onChange={(v) => setLivingRooms(v ?? 0)} min={0} max={3} />
                      <TkxNumberInput label={t("design.wizard.studyRooms")} value={studyRooms} onChange={(v) => setStudyRooms(v ?? 0)} min={0} max={3} />
                      <TkxNumberInput label={t("design.wizard.poojaRooms")} value={poojaRooms} onChange={(v) => setPoojaRooms(v ?? 0)} min={0} max={2} />
                    </div>
                  </div>
                )}

                {(isCommercial || isMixed) && (
                  <div>
                    <SectionTitle>{t("design.wizard.commercialSpaces")}</SectionTitle>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                      <TkxNumberInput label={t("design.wizard.workstations")} value={workstations} onChange={(v) => setWorkstations(v ?? 0)} min={0} max={2000} step={5} />
                      <TkxNumberInput label={t("design.wizard.cabins")} value={cabins} onChange={(v) => setCabins(v ?? 0)} min={0} max={50} />
                      <TkxNumberInput label={t("design.wizard.meetingRooms")} value={meetingRooms} onChange={(v) => setMeetingRooms(v ?? 0)} min={0} max={20} />
                      <TkxNumberInput label={t("design.wizard.retailUnits")} value={retailUnits} onChange={(v) => setRetailUnits(v ?? 0)} min={0} max={50} />
                      <TkxCheckbox label={t("design.wizard.cafeteria")} checked={cafeteria} onChange={setCafeteria} />
                    </div>
                  </div>
                )}

                <div>
                  <SectionTitle>{t("design.wizard.parking")}</SectionTitle>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <TkxNumberInput label={t("design.wizard.carParking")} value={cars} onChange={(v) => setCars(v ?? 0)} min={0} max={500} />
                    <TkxNumberInput label={t("design.wizard.bikeParking")} value={bikes} onChange={(v) => setBikes(v ?? 0)} min={0} max={500} />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3 — Amenities */}
            {activeStep === 3 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
                {[
                  [t("design.wizard.balcony"), balcony, setBalcony] as const,
                  [t("design.wizard.terrace"), terrace, setTerrace] as const,
                  [t("design.wizard.garden"), garden, setGarden] as const,
                  [t("design.wizard.lift"), lift, setLift] as const,
                  [t("design.wizard.solar"), solar, setSolar] as const,
                  [t("design.wizard.rainwater"), rainwater, setRainwater] as const,
                ].map(([label, val, set]) => (
                  <TkxCard key={label} variant="outlined" padding="sm">
                    <TkxCheckbox label={label} checked={val} onChange={set} />
                  </TkxCard>
                ))}
              </div>
            )}

            {/* STEP 4 — Style */}
            {activeStep === 4 && (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <TkxSelect label={t("design.wizard.style")} options={STYLE_OPTIONS} value={style} onChange={(v) => setStyle(v as string)} />
                  <TkxSelect label={t("design.wizard.climate")} options={CLIMATE_OPTIONS} value={climate} onChange={(v) => setClimate(v as string)} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  <TkxCard variant="outlined" padding="sm">
                    <TkxCheckbox label={t("design.wizard.vastu")} checked={vastuCompliant} onChange={setVastuCompliant} />
                  </TkxCard>
                  <TkxCard variant="outlined" padding="sm">
                    <TkxCheckbox label={t("design.wizard.accessibility")} checked={accessibility} onChange={setAccessibility} />
                  </TkxCard>
                  <TkxCard variant="outlined" padding="sm">
                    <TkxCheckbox label={t("design.wizard.sustainable")} checked={sustainable} onChange={setSustainable} />
                  </TkxCard>
                </div>
                <TkxInput
                  label={t("design.wizard.notes")}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  hint={t("design.wizard.notesHint")}
                />
              </div>
            )}

            {/* STEP 5 — Review */}
            {activeStep === 5 && (
              <div style={{ display: "grid", gap: 16 }}>
                {source === "public_lead" && (
                  <TkxAlert variant="info" title={t("design.wizard.contactTitle")}>
                    {t("design.wizard.contactBody")}
                    <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <TkxInput label={t("common.name")} value={leadName} onChange={(e) => setLeadName(e.target.value)} isRequired />
                        <TkxInput label={t("common.phone")} value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} placeholder="+91…" isRequired />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <TkxInput label={t("common.email")} type="email" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} />
                        <TkxInput label={t("common.city")} value={leadCity} onChange={(e) => setLeadCity(e.target.value)} placeholder={t("design.wizard.cityPlaceholder")} isRequired />
                      </div>
                      <TkxButton
                        variant="ghost"
                        size="sm"
                        type="button"
                        onClick={() => {
                          if (!navigator.geolocation) return;
                          navigator.geolocation.getCurrentPosition(
                            (pos) => setLeadCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                            () => {}
                          );
                        }}
                      >
                        {leadCoords ? `✓ ${t("design.wizard.locationShared")}` : t("design.wizard.shareLocation")}
                      </TkxButton>
                    </div>
                  </TkxAlert>
                )}

                <TkxCard variant="outlined" padding="md">
                  <SectionTitle>{t("design.wizard.summary")}</SectionTitle>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
                    <TkxBadge variant="primary" outlined>{t(`design.projectTypeShort.${projectType}`)}</TkxBadge>
                    <TkxBadge variant="info" outlined>{t("design.sqftValue", { value: formatNumber(totalSqft, locale) })}</TkxBadge>
                    <TkxBadge variant="info" outlined>FAR {maxFAR}</TkxBadge>
                    <TkxBadge variant="info" outlined>{t("design.wizard.summary.facing", { facing: t(`design.facing.${facing}`) })}</TkxBadge>
                    <TkxBadge variant="success" outlined>
                      {t(floors > 1 ? "design.wizard.summary.floors" : "design.wizard.summary.floor", { count: floors })}
                      {projectType === "residential_apartment" ? ` × ${t("design.wizard.summary.units", { count: unitsPerFloor })}` : ""}
                    </TkxBadge>
                  </div>
                  {!isCommercial && (
                    <div style={{ fontSize: 13, color: "#4b5563" }}>
                      {t("design.wizard.summary.rooms", { bedrooms, bathrooms, living: livingRooms })}
                      {poojaRooms ? ` · ${t("design.wizard.summary.pooja", { count: poojaRooms })}` : ""}
                      {studyRooms ? ` · ${t("design.wizard.summary.study", { count: studyRooms })}` : ""}
                    </div>
                  )}
                  {(isCommercial || isMixed) && (
                    <div style={{ fontSize: 13, color: "#4b5563" }}>
                      {t("design.wizard.summary.commercial", { workstations, cabins, meetings: meetingRooms })}
                      {retailUnits ? ` · ${t("design.wizard.summary.retail", { count: retailUnits })}` : ""}
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                    {t("design.wizard.summary.styleClimate", {
                      style: t(`design.style.${style}`).toLowerCase(),
                      climate: t(`design.climate.${climate}`).toLowerCase(),
                    })}
                  </div>
                </TkxCard>
              </div>
            )}
          </div>

          <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", gap: 8 }}>
            <TkxButton
              type="button"
              variant="ghost"
              colorScheme="secondary"
              disabled={activeStep === 0}
              onClick={() => setActiveStep((s) => s - 1)}
            >
              ← {t("common.back")}
            </TkxButton>
            {activeStep < STEPS.length - 1 ? (
              <TkxButton
                type="button"
                variant="solid"
                colorScheme="primary"
                onClick={() => setActiveStep((s) => s + 1)}
              >
                {t("common.next")} →
              </TkxButton>
            ) : (
              <TkxButton
                type="submit"
                variant="solid"
                colorScheme="primary"
                size="lg"
                isLoading={submitting}
                loadingText={t("design.wizard.generating")}
                disabled={!canSubmit}
                aria-describedby={canSubmit ? undefined : "wizard-cannot-submit"}
                glow
              >
                {t("design.wizard.generate")}
              </TkxButton>
            )}
          </div>
          {!canSubmit && (
            <p id="wizard-cannot-submit" className="sr-only">
              {t("design.wizard.cannotSubmit")}
            </p>
          )}
          </form>
        </TkxCardBody>
      </TkxCard>
    </>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>
      {children}
    </div>
  );
}
