import type {
  AuditLogDoc,
  IncidentDoc,
  IncidentNotificationDoc,
  UserDoc,
  VolunteerApplicationDoc,
  VolunteerDoc,
} from "./types";

export const DEMO_PASSWORDS = {
  operator: "HerShieldOp#2026",
  admin: "HerShieldAdmin#2026",
  volunteer: "HerShieldVol#2026",
};

export function buildSeedUsers(passwordHashes: {
  operator: string;
  admin: string;
  volunteer: string;
}): UserDoc[] {
  const now = new Date().toISOString();
  return [
    {
      _id: "usr-operator-01",
      name: "Meera Nair (Demo Operator)",
      email: "operator@hershield.demo",
      passwordHash: passwordHashes.operator,
      role: "operator",
      accountStatus: "active",
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: "usr-admin-01",
      name: "Kavya Rao (Demo Admin)",
      email: "admin@hershield.demo",
      passwordHash: passwordHashes.admin,
      role: "admin",
      accountStatus: "active",
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: "usr-vol-01",
      name: "Ananya Sharma (Demo Volunteer)",
      email: "ananya.demo@hershield.demo",
      passwordHash: passwordHashes.volunteer,
      role: "volunteer",
      accountStatus: "active",
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: "usr-vol-02",
      name: "Priya Menon (Demo Volunteer)",
      email: "priya.demo@hershield.demo",
      passwordHash: passwordHashes.volunteer,
      role: "volunteer",
      accountStatus: "active",
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: "usr-vol-03",
      name: "Riya Verma (Demo Volunteer)",
      email: "riya.demo@hershield.demo",
      passwordHash: passwordHashes.volunteer,
      role: "volunteer",
      accountStatus: "active",
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: "usr-vol-04",
      name: "Sneha Kulkarni (Demo Volunteer)",
      email: "sneha.demo@hershield.demo",
      passwordHash: passwordHashes.volunteer,
      role: "volunteer",
      accountStatus: "active",
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: "usr-vol-05",
      name: "Neha Deshmukh (Demo Volunteer)",
      email: "neha.demo@hershield.demo",
      passwordHash: passwordHashes.volunteer,
      role: "volunteer",
      accountStatus: "active",
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: "usr-vol-06",
      name: "Aisha Khan (Pending Applicant)",
      email: "aisha.demo@hershield.demo",
      passwordHash: passwordHashes.volunteer,
      role: "volunteer",
      accountStatus: "active",
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function buildSeedVolunteers(): VolunteerDoc[] {
  const now = new Date().toISOString();
  return [
    {
      _id: "vol-01",
      userId: "usr-vol-01",
      displayName: "Ananya S. [DEMO]",
      registeredArea: "Indiranagar 100ft Rd, Bengaluru",
      registeredLocation: { type: "Point", coordinates: [77.6412, 12.9789] },
      telegramChatId: null,
      telegramUsername: null,
      telegramLinkCode: "HS-VOL-ANANYA01",
      verificationStatus: "Verified",
      alertEligible: true,
      isSimulatedDemo: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: "vol-02",
      userId: "usr-vol-02",
      displayName: "Priya M. [DEMO]",
      registeredArea: "Indiranagar CMH Rd, Bengaluru",
      registeredLocation: { type: "Point", coordinates: [77.6384, 12.9762] },
      telegramChatId: null,
      telegramUsername: null,
      telegramLinkCode: "HS-VOL-PRIYA02",
      verificationStatus: "Verified",
      alertEligible: true,
      isSimulatedDemo: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: "vol-03",
      userId: "usr-vol-03",
      displayName: "Riya V. [DEMO]",
      registeredArea: "Koramangala 4th Block, Bengaluru",
      registeredLocation: { type: "Point", coordinates: [77.6269, 12.9355] },
      telegramChatId: null,
      telegramUsername: null,
      telegramLinkCode: "HS-VOL-RIYA03",
      verificationStatus: "Verified",
      alertEligible: true,
      isSimulatedDemo: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: "vol-04",
      userId: "usr-vol-04",
      displayName: "Sneha K. [DEMO]",
      registeredArea: "HSR Layout Sector 2, Bengaluru",
      registeredLocation: { type: "Point", coordinates: [77.6472, 12.9125] },
      telegramChatId: null,
      telegramUsername: null,
      telegramLinkCode: "HS-VOL-SNEHA04",
      verificationStatus: "Verified",
      alertEligible: true,
      isSimulatedDemo: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: "vol-05",
      userId: "usr-vol-05",
      displayName: "Neha D. [DEMO]",
      registeredArea: "MG Road / Church St, Bengaluru",
      registeredLocation: { type: "Point", coordinates: [77.6062, 12.9752] },
      telegramChatId: null,
      telegramUsername: null,
      telegramLinkCode: "HS-VOL-NEHA05",
      verificationStatus: "Verified",
      alertEligible: true,
      isSimulatedDemo: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: "vol-06",
      userId: "usr-vol-06",
      displayName: "Aisha K. [DEMO]",
      registeredArea: "Jayanagar 4th Block, Bengaluru",
      registeredLocation: { type: "Point", coordinates: [77.5841, 12.9301] },
      telegramChatId: null,
      telegramUsername: null,
      telegramLinkCode: "HS-VOL-AISHA06",
      verificationStatus: "Under Review",
      alertEligible: false,
      isSimulatedDemo: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function buildSeedApplications(): VolunteerApplicationDoc[] {
  const now = new Date().toISOString();
  return [
    {
      _id: "app-01",
      userId: "usr-vol-01",
      applicantName: "Ananya Sharma (Demo Volunteer)",
      applicantEmail: "ananya.demo@hershield.demo",
      registeredArea: "Indiranagar 100ft Rd, Bengaluru",
      applicationStatus: "Verified",
      documentReferences: [
        {
          docId: "doc-demo-01",
          label: "Simulated Community ID Placeholder",
          fileName: "demo-community-id-ananya.txt",
          mimeType: "text/plain",
          sizeBytes: 256,
          uploadedAt: now,
          isDemoPlaceholder: true,
        },
      ],
      consentStatus: true,
      reviewNotes:
        "Demo record pre-verified for hackathon demonstration. No real criminal background check performed.",
      reviewedBy: "usr-admin-01",
      reviewedAt: now,
      submittedAt: now,
    },
    {
      _id: "app-06",
      userId: "usr-vol-06",
      applicantName: "Aisha Khan (Pending Applicant)",
      applicantEmail: "aisha.demo@hershield.demo",
      registeredArea: "Jayanagar 4th Block, Bengaluru",
      applicationStatus: "Under Review",
      documentReferences: [
        {
          docId: "doc-demo-06",
          label: "Simulated Volunteer ID Placeholder",
          fileName: "demo-id-placeholder-aisha.txt",
          mimeType: "text/plain",
          sizeBytes: 240,
          uploadedAt: now,
          isDemoPlaceholder: true,
        },
      ],
      consentStatus: true,
      reviewNotes: "Awaiting manual admin review in demonstration workflow.",
      reviewedBy: null,
      reviewedAt: null,
      submittedAt: now,
    },
  ];
}

// Non-identifying synthetic skeleton frames for the seeded demo incident
export function buildSeedIncidents(): IncidentDoc[] {
  const now = new Date(Date.now() - 8 * 60 * 1000).toISOString();
  const sampleFrames = Array.from({ length: 16 }).map((_, idx) => {
    const shift = idx * 4;
    return {
      t: Number((idx * 0.25).toFixed(2)),
      label: idx > 6 ? "Rapid proximity & arm raise" : "Approaching trajectories",
      boxes: [
        { x1: 170 + shift, y1: 110, x2: 245 + shift, y2: 320, trackId: 1 },
        { x1: 350 - shift, y1: 115, x2: 430 - shift, y2: 325, trackId: 2 },
      ],
      keypoints: [
        // Person 1 (17 COCO keypoints [x, y, conf] on 640x480 blank PrivacyShield canvas)
        [208 + shift, 130, 0.9],
        [204 + shift, 125, 0.9],
        [212 + shift, 125, 0.9],
        [200 + shift, 128, 0.8],
        [216 + shift, 128, 0.8],
        [190 + shift, 165, 0.9],
        [226 + shift, 165, 0.9],
        [182 + shift, 200, 0.85],
        [248 + shift + (idx > 6 ? 18 : 0), 150 - (idx > 6 ? 15 : 0), 0.9],
        [180 + shift, 230, 0.85],
        [268 + shift + (idx > 6 ? 25 : 0), 135 - (idx > 6 ? 20 : 0), 0.9],
        [195 + shift, 235, 0.9],
        [222 + shift, 235, 0.9],
        [192 + shift, 278, 0.88],
        [226 + shift, 278, 0.88],
        [190 + shift, 315, 0.85],
        [228 + shift, 315, 0.85],
      ],
    };
  });

  return [
    {
      _id: "inc-demo-001",
      incidentId: "HS-DEMO-1001",
      incidentType: "potential_aggression",
      incidentTitle: "Potential Physical Aggression Indicator",
      incidentConfidence: 74,
      confidenceType: "heuristic",
      detectionExplanation:
        "Heuristic indicator: 2 tracked persons closed distance below 0.9m with rapid wrist/upper-body displacement across 9 frames (simulated demo incident).",
      incidentLocation: {
        areaName: "Indiranagar 100ft Rd",
        approxLabel: "Near 100ft Road Junction, Indiranagar (Approx.)",
        coordinates: { type: "Point", coordinates: [77.6408, 12.9784] },
      },
      cameraSource: "sample_demo_clip",
      detectedAt: now,
      confirmationStatus: "confirmed",
      incidentStatus: "dispatched",
      sanitizedPreviewReference: null,
      sanitizedTimelineFrames: sampleFrames,
      previewSha256:
        "d8f1c9a0e4b722f4b823c9c1e8f9a10b4c2d8f1a09e6b1e5a92f41b2c0d39901",
      isSimulatedDemo: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function buildSeedNotifications(): IncidentNotificationDoc[] {
  const now = new Date(Date.now() - 7 * 60 * 1000).toISOString();
  return [
    {
      _id: "notif-demo-001",
      incidentId: "HS-DEMO-1001",
      volunteerId: "vol-01",
      volunteerName: "Ananya S. [DEMO]",
      registeredArea: "Indiranagar 100ft Rd, Bengaluru",
      distanceMeters: 68,
      telegramStatus: "not_linked",
      telegramError: "Demo volunteer has not linked a live Telegram chat ID yet.",
      notificationSentAt: now,
      acknowledgementStatus: "pending",
      acknowledgedAt: null,
    },
    {
      _id: "notif-demo-002",
      incidentId: "HS-DEMO-1001",
      volunteerId: "vol-02",
      volunteerName: "Priya M. [DEMO]",
      registeredArea: "Indiranagar CMH Rd, Bengaluru",
      distanceMeters: 356,
      telegramStatus: "not_linked",
      telegramError: "Demo volunteer has not linked a live Telegram chat ID yet.",
      notificationSentAt: now,
      acknowledgementStatus: "pending",
      acknowledgedAt: null,
    },
  ];
}

export function buildSeedAuditLogs(): AuditLogDoc[] {
  const now = new Date().toISOString();
  return [
    {
      _id: "aud-001",
      actorId: "system",
      actorRole: "system",
      action: "SEED_DEMO_DATASET",
      resourceType: "system",
      resourceId: "hershield-demo",
      timestamp: now,
      relevantMetadata: {
        note: "Initialized fictional demonstration accounts, volunteers, and PrivacyShield sample incident.",
      },
    },
  ];
}
