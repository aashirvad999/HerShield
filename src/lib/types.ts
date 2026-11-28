export type UserRole = "operator" | "volunteer" | "admin";
export type AccountStatus = "active" | "suspended" | "pending";
export type VerificationStatus =
  | "Submitted"
  | "Under Review"
  | "Verified"
  | "Rejected";

export type IncidentType =
  | "potential_aggression"
  | "potential_slap"
  | "potential_harassment"
  | "potential_chain_snatching"
  | "suspected_collapse"
  | "chest_clutching_warning"
  | "chain_snatching_demo"
  | "vehicle_pedestrian_demo";

export type ConfidenceType = "heuristic" | "calibrated_ml";
export type ConfirmationStatus =
  | "pending_timer"
  | "confirmed"
  | "false_positive"
  | "auto_confirmed";

export type IncidentStatus = "open" | "dispatched" | "acknowledged" | "closed";

export interface GeoJSONPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export interface UserDoc {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  accountStatus: AccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface VolunteerDoc {
  _id: string;
  userId: string;
  displayName: string;
  registeredArea: string;
  registeredLocation: GeoJSONPoint;
  telegramChatId: string | null;
  telegramUsername: string | null;
  telegramLinkCode: string;
  verificationStatus: VerificationStatus;
  alertEligible: boolean;
  isSimulatedDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentReference {
  docId: string;
  label: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  isDemoPlaceholder: boolean;
  localStorageKey?: string;
}

export interface VolunteerApplicationDoc {
  _id: string;
  userId: string;
  applicantName: string;
  applicantEmail: string;
  registeredArea: string;
  applicationStatus: VerificationStatus;
  documentReferences: DocumentReference[];
  consentStatus: boolean;
  reviewNotes: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  submittedAt: string;
}

export interface IncidentLocation {
  areaName: string;
  approxLabel: string;
  coordinates: GeoJSONPoint;
}

export interface IncidentDoc {
  _id?: string;
  incidentId: string;
  incidentType: IncidentType;
  incidentTitle: string;
  incidentConfidence: number; // 0..100
  confidenceType: ConfidenceType;
  detectionExplanation: string;
  incidentLocation: IncidentLocation;
  cameraSource: string;
  detectedAt: string;
  confirmationStatus: ConfirmationStatus;
  incidentStatus: IncidentStatus;
  sanitizedPreviewReference: string | null;
  sanitizedTimelineFrames?: Array<{
    t: number;
    keypoints: number[][];
    boxes: Array<{ x1: number; y1: number; x2: number; y2: number; trackId: number }>;
    label: string;
  }>;
  previewSha256: string | null;
  autoDispatched?: boolean;
  autoDispatchNote?: string;
  isSimulatedDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentNotificationDoc {
  _id?: string;
  incidentId: string;
  volunteerId: string;
  volunteerName: string;
  registeredArea: string;
  distanceMeters: number;
  telegramStatus:
    | "sent"
    | "failed"
    | "not_linked"
    | "telegram_unconfigured"
    | "pending";
  telegramError?: string | null;
  notificationSentAt: string;
  acknowledgementStatus: "pending" | "accepted" | "declined";
  acknowledgedAt: string | null;
}

export interface AuditLogDoc {
  _id?: string;
  actorId: string;
  actorRole: UserRole | "system" | "ai_service";
  action: string;
  resourceType:
    | "incident"
    | "volunteer"
    | "volunteer_application"
    | "notification"
    | "auth"
    | "system";
  resourceId: string;
  timestamp: string;
  relevantMetadata: Record<string, unknown>;
}

export interface DemoLocationPreset {
  id: string;
  areaName: string;
  approxLabel: string;
  lng: number;
  lat: number;
  city: string;
}

export const DEMO_LOCATION_PRESETS: DemoLocationPreset[] = [
  {
    id: "indiranagar-100ft",
    areaName: "Indiranagar 100ft Rd",
    approxLabel: "Near 100ft Road Junction, Indiranagar (Approx.)",
    lng: 77.6408,
    lat: 12.9784,
    city: "Bengaluru",
  },
  {
    id: "koramangala-4th",
    areaName: "Koramangala 4th Block",
    approxLabel: "Near 80ft Road, Koramangala 4th Block (Approx.)",
    lng: 77.6271,
    lat: 12.9352,
    city: "Bengaluru",
  },
  {
    id: "hsr-sector-2",
    areaName: "HSR Layout Sector 2",
    approxLabel: "Near 27th Main Road, HSR Sector 2 (Approx.)",
    lng: 77.6476,
    lat: 12.9121,
    city: "Bengaluru",
  },
  {
    id: "mg-road-metro",
    areaName: "MG Road Boulevard",
    approxLabel: "Near Church Street / MG Road Metro (Approx.)",
    lng: 77.6066,
    lat: 12.9756,
    city: "Bengaluru",
  },
  {
    id: "jayanagar-4th",
    areaName: "Jayanagar 4th Block",
    approxLabel: "Near 11th Main Complex, Jayanagar (Approx.)",
    lng: 77.5838,
    lat: 12.9299,
    city: "Bengaluru",
  },
];

export const INCIDENT_TYPE_LABELS: Record<
  IncidentType,
  { title: string; badge: string; disclaimer: string }
> = {
  potential_aggression: {
    title: "Potential Physical Aggression Indicator",
    badge: "Heuristic Aggression Signal",
    disclaimer:
      "Experimental heuristic score based on person proximity, velocity spikes, and rapid pose shifts — not proof of a crime.",
  },
  potential_slap: {
    title: "Potential Slap / Facial Strike Indicator",
    badge: "Heuristic Strike Signal",
    disclaimer:
      "Experimental heuristic indicator based on rapid wrist acceleration toward another person's head/face region and head recoil — requires operator verification.",
  },
  potential_harassment: {
    title: "Potential Harassment / Intrusive Contact Indicator",
    badge: "Heuristic Harassment Signal",
    disclaimer:
      "Experimental heuristic indicator based on sustained intrusive proximity, unwanted arm/torso contact, or cornering cues — requires operator verification.",
  },
  potential_chain_snatching: {
    title: "Potential Chain-Snatching / Grab-and-Flee Indicator",
    badge: "Heuristic Snatching Signal",
    disclaimer:
      "Experimental heuristic indicator based on rapid reach toward another person's neck/upper-chest zone followed by rapid separation — requires operator verification.",
  },
  suspected_collapse: {
    title: "Suspected Collapse (5s Ground Confirmation)",
    badge: "Pose Collapse Signal",
    disclaimer:
      "Person transitioned to horizontal/ground posture and remained down for the 5-second confirmation window — not a medical diagnosis.",
  },
  chest_clutching_warning: {
    title: "Experimental Chest-Clutching Pre-Collapse Indicator",
    badge: "Experimental Warning",
    disclaimer:
      "Experimental posture gesture warning only; never diagnoses a medical event or cardiac condition.",
  },
  chain_snatching_demo: {
    title: "Chain-Snatching Scenario (Demonstration Clip)",
    badge: "Experimental Scenario",
    disclaimer:
      "Demonstrated on prerecorded scenario footage; classified as an experimental capability.",
  },
  vehicle_pedestrian_demo: {
    title: "Vehicle / Pedestrian Proximity Incident (Demo)",
    badge: "Experimental Scenario",
    disclaimer:
      "Demonstrated on prerecorded scenario footage; secondary prototype capability.",
  },
};
