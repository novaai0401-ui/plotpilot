"use client";
import { useEffect, useMemo, useRef, useState } from "react";
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

type WizardProps = {
  source: "broker" | "client" | "public_lead" | "standalone";
  plotId?: string;
  defaultPlotSqft?: number;
  onComplete?: (designId: string) => void;
};

const STEPS = [
  { id: "project", title: "Project", description: "Type & purpose" },
  { id: "plot", title: "Plot", description: "Size & rules" },
  { id: "layout", title: "Layout", description: "Rooms & floors" },
  { id: "amenities", title: "Amenities", description: "Add-ons" },
  { id: "style", title: "Style", description: "Look & feel" },
  { id: "review", title: "Review", description: "Generate" },
];

const PROJECT_TYPE_OPTIONS: SelectOption[] = [
  { value: "residential_house", label: "Residential — standalone house / villa" },
  { value: "residential_apartment", label: "Residential — apartment building" },
  { value: "commercial_office", label: "Commercial — office" },
  { value: "commercial_retail", label: "Commercial — retail / shop" },
  { value: "mixed_use", label: "Mixed-use (retail + residential)" },
];

const FACING_OPTIONS: SelectOption[] = ["N", "E", "S", "W", "NE", "NW", "SE", "SW"].map((v) => ({ value: v, label: v }));
const STYLE_OPTIONS: SelectOption[] = [
  "modern", "contemporary", "traditional", "minimalist", "industrial", "mediterranean", "colonial",
].map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }));
const CLIMATE_OPTIONS: SelectOption[] = [
  "tropical", "temperate", "arid", "cold", "humid",
].map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }));

export function RequirementsWizard({ source, plotId, defaultPlotSqft, onComplete }: WizardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [activeStep, setActiveStep] = useState(0);

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
      const res = await fetch("/api/architect/generate", {
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
        throw new Error(j.error || "Generation failed");
      }
      toast({ title: "Design generated!", variant: "success" });
      if (onComplete) return onComplete(j.id);
      router.push(`/designs/${j.id}`);
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message, variant: "danger" });
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = source !== "public_lead" || (leadName.trim() !== "" && leadPhone.trim() !== "");

  return (
    <>
      <UpgradeModal open={capInfo !== null} onClose={() => setCapInfo(null)} cap={capInfo} />

      <TkxCard variant="elevated" padding="lg">
        <TkxCardHeader title="Design a building" subtitle="Walk through six steps; the engine handles the rest." />
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
            aria-label="Building design wizard"
            onSubmit={(e) => {
              e.preventDefault();
              if (activeStep < STEPS.length - 1) {
                setActiveStep((s) => s + 1);
              } else if (canSubmit && !submitting) {
                onSubmit();
              }
            }}
          >
          <TkxStepper
            steps={STEPS.map((s, i) => ({
              id: s.id,
              title: s.title,
              description: s.description,
              status: i < activeStep ? "completed" : i === activeStep ? "active" : "pending",
            }))}
            activeStep={activeStep}
            clickable
            onStepClick={(i) => setActiveStep(i)}
            variant="default"
            connector="solid"
            size="md"
          />

          {/* Hidden focus target + live region. The heading is sr-only but
              focusable (tabIndex=-1) so the focus ring isn't visible. The
              second div announces step transitions to screen readers. */}
          <h2
            ref={stepHeadingRef}
            tabIndex={-1}
            className="sr-only"
            aria-live="polite"
          >
            {`Step ${activeStep + 1} of ${STEPS.length}: ${STEPS[activeStep].title} — ${STEPS[activeStep].description}`}
          </h2>

          <div
            role="group"
            aria-labelledby="wizard-step-region"
            style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16 }}
          >
            {/* STEP 0 — Project type */}
            {activeStep === 0 && (
              <TkxSelect
                label="Project type"
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
                    label="Total plot area (sqft)"
                    value={totalSqft}
                    onChange={(v) => setTotalSqft(v ?? 0)}
                    min={200}
                    max={500_000}
                    suffix=" sqft"
                  />
                  <TkxSelect
                    label="Facing"
                    options={FACING_OPTIONS}
                    value={facing}
                    onChange={(v) => setFacing(v as string)}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <TkxNumberInput
                    label="Frontage (ft) — optional"
                    value={frontageFt ?? undefined}
                    onChange={(v) => setFrontageFt(v)}
                    min={10}
                    max={2000}
                  />
                  <TkxNumberInput
                    label="Depth (ft) — optional"
                    value={depthFt ?? undefined}
                    onChange={(v) => setDepthFt(v)}
                    min={10}
                    max={2000}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                  <TkxNumberInput label="FAR cap" value={maxFAR} onChange={(v) => setMaxFAR(v ?? 2)} step={0.1} min={0.5} max={10} precision={1} />
                  <TkxNumberInput label="Setback front (ft)" value={setbackFront} onChange={(v) => setSetbackFront(v ?? 5)} min={0} max={50} />
                  <TkxNumberInput label="Setback rear (ft)" value={setbackRear} onChange={(v) => setSetbackRear(v ?? 3)} min={0} max={50} />
                  <TkxNumberInput label="Setback sides (ft)" value={setbackSide} onChange={(v) => setSetbackSide(v ?? 3)} min={0} max={50} />
                </div>
              </div>
            )}

            {/* STEP 2 — Layout */}
            {activeStep === 2 && (
              <div style={{ display: "grid", gap: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <TkxNumberInput label="Number of floors" value={floors} onChange={(v) => setFloors(v ?? 1)} min={1} max={50} />
                  {projectType === "residential_apartment" && (
                    <TkxNumberInput label="Units per floor" value={unitsPerFloor} onChange={(v) => setUnitsPerFloor(v ?? 1)} min={1} max={50} />
                  )}
                </div>

                {!isCommercial && (
                  <div>
                    <SectionTitle>Residential rooms {projectType === "residential_apartment" ? "(per unit)" : ""}</SectionTitle>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                      <TkxNumberInput label="Bedrooms" value={bedrooms} onChange={(v) => setBedrooms(v ?? 0)} min={0} max={10} />
                      <TkxNumberInput label="Bathrooms" value={bathrooms} onChange={(v) => setBathrooms(v ?? 0)} min={0} max={10} />
                      <TkxNumberInput label="Living rooms" value={livingRooms} onChange={(v) => setLivingRooms(v ?? 0)} min={0} max={3} />
                      <TkxNumberInput label="Study rooms" value={studyRooms} onChange={(v) => setStudyRooms(v ?? 0)} min={0} max={3} />
                      <TkxNumberInput label="Pooja rooms" value={poojaRooms} onChange={(v) => setPoojaRooms(v ?? 0)} min={0} max={2} />
                    </div>
                  </div>
                )}

                {(isCommercial || isMixed) && (
                  <div>
                    <SectionTitle>Commercial spaces</SectionTitle>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                      <TkxNumberInput label="Workstations" value={workstations} onChange={(v) => setWorkstations(v ?? 0)} min={0} max={2000} step={5} />
                      <TkxNumberInput label="Cabins" value={cabins} onChange={(v) => setCabins(v ?? 0)} min={0} max={50} />
                      <TkxNumberInput label="Meeting rooms" value={meetingRooms} onChange={(v) => setMeetingRooms(v ?? 0)} min={0} max={20} />
                      <TkxNumberInput label="Retail units" value={retailUnits} onChange={(v) => setRetailUnits(v ?? 0)} min={0} max={50} />
                      <TkxCheckbox label="Cafeteria" checked={cafeteria} onChange={(e) => setCafeteria(e.target.checked)} />
                    </div>
                  </div>
                )}

                <div>
                  <SectionTitle>Parking</SectionTitle>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <TkxNumberInput label="Car parking" value={cars} onChange={(v) => setCars(v ?? 0)} min={0} max={500} />
                    <TkxNumberInput label="Bike parking" value={bikes} onChange={(v) => setBikes(v ?? 0)} min={0} max={500} />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3 — Amenities */}
            {activeStep === 3 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
                {[
                  ["Balcony", balcony, setBalcony] as const,
                  ["Terrace", terrace, setTerrace] as const,
                  ["Garden", garden, setGarden] as const,
                  ["Lift", lift, setLift] as const,
                  ["Solar PV", solar, setSolar] as const,
                  ["Rainwater harvesting", rainwater, setRainwater] as const,
                ].map(([label, val, set]) => (
                  <TkxCard key={label} variant="outlined" padding="sm">
                    <TkxCheckbox label={label} checked={val} onChange={(e) => set(e.target.checked)} />
                  </TkxCard>
                ))}
              </div>
            )}

            {/* STEP 4 — Style */}
            {activeStep === 4 && (
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <TkxSelect label="Style" options={STYLE_OPTIONS} value={style} onChange={(v) => setStyle(v as string)} />
                  <TkxSelect label="Climate" options={CLIMATE_OPTIONS} value={climate} onChange={(v) => setClimate(v as string)} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                  <TkxCard variant="outlined" padding="sm">
                    <TkxCheckbox label="Vastu compliant" checked={vastuCompliant} onChange={(e) => setVastuCompliant(e.target.checked)} />
                  </TkxCard>
                  <TkxCard variant="outlined" padding="sm">
                    <TkxCheckbox label="Accessibility" checked={accessibility} onChange={(e) => setAccessibility(e.target.checked)} />
                  </TkxCard>
                  <TkxCard variant="outlined" padding="sm">
                    <TkxCheckbox label="Sustainable build" checked={sustainable} onChange={(e) => setSustainable(e.target.checked)} />
                  </TkxCard>
                </div>
                <TkxInput
                  label="Notes for the AI (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  hint="Anything special — accessibility needs, plot constraints, design references."
                />
              </div>
            )}

            {/* STEP 5 — Review */}
            {activeStep === 5 && (
              <div style={{ display: "grid", gap: 16 }}>
                {source === "public_lead" && (
                  <TkxAlert variant="info" title="Contact details">
                    Share these so a broker in your area can follow up. We'll never spam you.
                    <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <TkxInput label="Name" value={leadName} onChange={(e) => setLeadName(e.target.value)} isRequired />
                        <TkxInput label="Phone" value={leadPhone} onChange={(e) => setLeadPhone(e.target.value)} placeholder="+91…" isRequired />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <TkxInput label="Email" type="email" value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} />
                        <TkxInput label="City" value={leadCity} onChange={(e) => setLeadCity(e.target.value)} placeholder="e.g. Bangalore" isRequired />
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
                        {leadCoords ? "✓ Location shared (matches nearby brokers)" : "Share my location (optional)"}
                      </TkxButton>
                    </div>
                  </TkxAlert>
                )}

                <TkxCard variant="outlined" padding="md">
                  <SectionTitle>Summary</SectionTitle>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
                    <TkxBadge variant="primary" outlined>{projectType.replace(/_/g, " ")}</TkxBadge>
                    <TkxBadge variant="info" outlined>{totalSqft.toLocaleString()} sqft</TkxBadge>
                    <TkxBadge variant="info" outlined>FAR {maxFAR}</TkxBadge>
                    <TkxBadge variant="info" outlined>facing {facing}</TkxBadge>
                    <TkxBadge variant="success" outlined>
                      {floors} floor{floors > 1 ? "s" : ""}
                      {projectType === "residential_apartment" ? ` × ${unitsPerFloor} units` : ""}
                    </TkxBadge>
                  </div>
                  {!isCommercial && (
                    <div style={{ fontSize: 13, color: "#4b5563" }}>
                      {bedrooms} BR · {bathrooms} BA · {livingRooms} LR
                      {poojaRooms ? ` · ${poojaRooms} pooja` : ""}
                      {studyRooms ? ` · ${studyRooms} study` : ""}
                    </div>
                  )}
                  {(isCommercial || isMixed) && (
                    <div style={{ fontSize: 13, color: "#4b5563" }}>
                      {workstations} workstations · {cabins} cabins · {meetingRooms} meetings
                      {retailUnits ? ` · ${retailUnits} retail` : ""}
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{style}, {climate} climate</div>
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
              ← Back
            </TkxButton>
            {activeStep < STEPS.length - 1 ? (
              <TkxButton
                type="button"
                variant="solid"
                colorScheme="primary"
                onClick={() => setActiveStep((s) => s + 1)}
              >
                Next →
              </TkxButton>
            ) : (
              <TkxButton
                type="submit"
                variant="solid"
                colorScheme="primary"
                size="lg"
                isLoading={submitting}
                loadingText="Generating design (~30s)…"
                disabled={!canSubmit}
                aria-describedby={canSubmit ? undefined : "wizard-cannot-submit"}
                glow
              >
                Generate design
              </TkxButton>
            )}
          </div>
          {!canSubmit && (
            <p id="wizard-cannot-submit" className="sr-only">
              Fill in name and phone in the review step before generating.
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
