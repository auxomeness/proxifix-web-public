export type AppRole = 'client' | 'worker' | 'admin'
export type Tone = 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
export type Availability = 'Available' | 'Busy' | 'Offline'
export type NavIconKey =
  | 'badge-check'
  | 'bookmark'
  | 'briefcase-business'
  | 'file-plus-2'
  | 'history'
  | 'layout-dashboard'
  | 'map-pinned'
  | 'messages-square'
  | 'receipt-text'
  | 'settings-2'
  | 'shield-check'
  | 'triangle-alert'
  | 'user-round'
  | 'users'

export interface NavItem {
  label: string
  to: string
  icon: NavIconKey
  caption: string
}

export interface NavGroup {
  title: string
  items: NavItem[]
}

export interface MetricItem {
  label: string
  value: string
  helper: string
  tone: Tone
}

export interface ConcernItem {
  id: string
  title: string
  category: string
  urgency: 'Urgent' | 'Normal' | 'Low'
  status: 'Open' | 'Awaiting responses' | 'Worker selected' | 'In progress' | 'Completed' | 'Cancelled'
  distanceKm: number
  schedule: string
  budget: string
  location: string
  description: string
  responseCount: number
  approximateLocationLabel?: string
  exactLocationLabel?: string | null
  exactLatitude?: number | null
  exactLongitude?: number | null
  locationPrivacyState?: 'approximate' | 'request_pending' | 'exact_shared'
  locationRequestedByRole?: 'client' | 'worker' | null
  locationSharedByRole?: 'client' | 'worker' | null
  locationSharedUntil?: string | null
  selectedWorkerId?: string | null
  selectedWorkerName?: string | null
  selectedWorkerSpecialty?: string | null
  selectedOfferPrice?: string | null
}

export interface WorkerCardItem {
  id: string
  name: string
  specialty: string
  rating: number
  completedJobs: number
  distanceKm: number
  availability: Availability
  verified: boolean
  responseTime: string
  location: string
  note: string
  tags: string[]
  portfolio?: Array<{
    id: string
    title: string
    description: string
  }>
}

export interface OfferItem {
  id: string
  workerName: string
  specialty: string
  price: string
  eta: string
  schedule: string
  note: string
  rating: number
  verified: boolean
}

export interface ThreadItem {
  id: string
  name: string
  role: string
  specialty: string
  summary: string
  time: string
  unread: number
  status: string
  verified: boolean
  online: boolean
  concernId: string
  concernTitle: string
}

export interface ChatMessage {
  id: string
  sender: 'client' | 'worker'
  body: string
  time: string
}

export interface MapPoint {
  id: string
  label: string
  lat: number
  lng: number
  kind: 'concern' | 'worker'
}

export interface WorkerLead {
  id: string
  title: string
  category: string
  distanceKm: number
  budget: string
  urgency: 'Urgent' | 'Normal' | 'Low'
  schedule: string
  location: string
}

export interface VerificationApplication {
  id: string
  name: string
  specialty: string
  submittedAt: string
  coverage: string
  documents: string[]
  status: 'Pending' | 'Under review' | 'Approved' | 'Rejected'
  note: string
}

export interface ReportItem {
  id: string
  title: string
  severity: 'High' | 'Medium' | 'Low'
  submittedBy: string
  createdAt: string
  reason: string
  status: 'Open' | 'Investigating' | 'Resolved'
}

export interface AdminUserItem {
  id: string
  name: string
  role: 'Client' | 'Worker'
  status: 'Active' | 'Suspended' | 'Pending'
  location: string
  joinedAt: string
  note: string
}

export const roleLabels: Record<AppRole, string> = {
  client: 'Client',
  worker: 'Worker',
  admin: 'Admin'
}

export const roleDestinations: Record<AppRole, string> = {
  client: '/app/client/overview',
  worker: '/app/worker/overview',
  admin: '/app/admin/overview'
}

export const roleNavigation: Record<AppRole, NavGroup[]> = {
  client: [
    {
      title: 'Work',
      items: [
        {
          label: 'Dashboard',
          to: '/app/client/overview',
          icon: 'layout-dashboard',
          caption: 'See open jobs, offers, and the next action that matters.'
        },
        {
          label: 'Jobs',
          to: '/app/client/concerns',
          icon: 'file-plus-2',
          caption: 'Post requests, manage statuses, and edit active jobs.'
        },
        {
          label: 'Offers',
          to: '/app/client/offers',
          icon: 'receipt-text',
          caption: 'Compare received offers and confirm who to hire.'
        },
        {
          label: 'Messages',
          to: '/app/client/messages',
          icon: 'messages-square',
          caption: 'Keep every worker conversation in one inbox.'
        }
      ]
    },
    {
      title: 'Find',
      items: [
        {
          label: 'Workers',
          to: '/app/client/workers',
          icon: 'map-pinned',
          caption: 'Compare verified specialists by distance and fit.'
        },
        {
          label: 'Saved',
          to: '/app/client/saved-workers',
          icon: 'bookmark',
          caption: 'Manage trusted workers you want to rehire or compare later.'
        }
      ]
    },
    {
      title: 'Account',
      items: [
        {
          label: 'Profile',
          to: '/app/client/profile',
          icon: 'user-round',
          caption: 'Manage your account details, saved workers, and reviews.'
        },
        {
          label: 'History',
          to: '/app/client/history',
          icon: 'history',
          caption: 'Track recent actions and manage recently deleted jobs.'
        },
        {
          label: 'Settings',
          to: '/app/client/settings',
          icon: 'settings-2',
          caption: 'Switch theme and manage account appearance preferences.'
        }
      ]
    }
  ],
  worker: [
    {
      title: 'Work',
      items: [
        {
          label: 'Dashboard',
          to: '/app/worker/overview',
          icon: 'layout-dashboard',
          caption: 'See open leads, active offers, and work in motion.'
        },
        {
          label: 'Jobs',
          to: '/app/worker/jobs',
          icon: 'briefcase-business',
          caption: 'Review leads, send offers, and manage job progression.'
        },
        {
          label: 'Offers',
          to: '/app/worker/offers',
          icon: 'receipt-text',
          caption: 'Track sent offers and accepted or declined outcomes.'
        },
        {
          label: 'Messages',
          to: '/app/worker/messages',
          icon: 'messages-square',
          caption: 'Keep client coordination and follow-up in one inbox.'
        },
        {
          label: 'History',
          to: '/app/worker/history',
          icon: 'history',
          caption: 'Review recent lead actions, offers, and account activity.'
        }
      ]
    },
    {
      title: 'Account',
      items: [
        {
          label: 'Profile',
          to: '/app/worker/profile',
          icon: 'badge-check',
          caption: 'Manage verification, portfolio, and coverage area.'
        },
        {
          label: 'Settings',
          to: '/app/worker/settings',
          icon: 'settings-2',
          caption: 'Switch theme and manage account appearance preferences.'
        }
      ]
    }
  ],
  admin: [
    {
      title: 'Console',
      items: [
        {
          label: 'Dashboard',
          to: '/app/admin/overview',
          icon: 'layout-dashboard',
          caption: 'Track moderation, verification, and platform health.'
        },
        {
          label: 'Verification',
          to: '/app/admin/verification',
          icon: 'shield-check',
          caption: 'Approve, reject, and request worker resubmissions.'
        },
        {
          label: 'Reports',
          to: '/app/admin/reports',
          icon: 'triangle-alert',
          caption: 'Handle complaints, fraud flags, and suspensions.'
        },
        {
          label: 'Users',
          to: '/app/admin/users',
          icon: 'users',
          caption: 'Search accounts, review profiles, and control access.'
        }
      ]
    },
    {
      title: 'Account',
      items: [
        {
          label: 'Settings',
          to: '/app/admin/settings',
          icon: 'settings-2',
          caption: 'Switch theme and manage console appearance preferences.'
        }
      ]
    }
  ]
}

export const landingMetrics: MetricItem[] = [
  {
    label: 'Nearby verified workers',
    value: '184',
    helper: 'Active across Metro Manila with verified visibility.',
    tone: 'accent'
  },
  {
    label: 'Median first response',
    value: '11 min',
    helper: 'Fast matching for urgent home and service requests.',
    tone: 'success'
  },
  {
    label: 'Verification queue SLA',
    value: '6 hrs',
    helper: 'Admin review target for submitted worker documents.',
    tone: 'info'
  }
]

export const platformHighlights = [
  {
    title: 'Proximity-ranked matching',
    body: 'Workers are ranked by distance, category fit, availability, and trust signals so the first shortlist is actually useful.'
  },
  {
    title: 'Structured offers, not vague replies',
    body: 'Every response can include price, schedule, and service notes so clients compare options cleanly instead of digging through chat.'
  },
  {
    title: 'Verification built into the workflow',
    body: 'Admins review IDs and credentials before workers become visible, and rejected applications can be resubmitted with feedback.'
  }
]

export const stackSummary = [
  'Vue 3 + TypeScript + Vite',
  'Tailwind CSS + Pinia',
  'Leaflet + OpenStreetMap',
  'Cloudflare Workers + PostgreSQL + R2'
]

export const clientMetrics: MetricItem[] = [
  {
    label: 'Open jobs',
    value: '07',
    helper: '2 urgent jobs still waiting on a selected worker.',
    tone: 'accent'
  },
  {
    label: 'Verified matches nearby',
    value: '24',
    helper: 'Workers inside your preferred 5 km radius.',
    tone: 'success'
  },
  {
    label: 'Average offer spread',
    value: '₱1,850',
    helper: 'Median quote range for this week’s submitted jobs.',
    tone: 'info'
  },
  {
    label: 'Completion rate',
    value: '93%',
    helper: 'Resolved jobs with rated worker handoff.',
    tone: 'success'
  }
]

export const clientConcerns: ConcernItem[] = [
  {
    id: 'CON-201',
    title: 'Kitchen sink leak with low water pressure',
    category: 'Plumbing',
    urgency: 'Urgent',
    status: 'Awaiting responses',
    distanceKm: 2.4,
    schedule: 'Today, 6:30 PM',
    budget: '₱1,500 - ₱2,300',
    location: 'Makati service zone',
    description: 'Leak under the sink started this morning and the faucet pressure dropped significantly.',
    responseCount: 4
  },
  {
    id: 'CON-188',
    title: 'Aircon cleaning for two-bedroom unit',
    category: 'Cooling Services',
    urgency: 'Normal',
    status: 'Worker selected',
    distanceKm: 3.1,
    schedule: 'Tomorrow, 10:00 AM',
    budget: '₱2,800 - ₱3,600',
    location: 'Pasig service zone',
    description: 'Three indoor units need standard cleaning before the weekend.',
    responseCount: 6
  },
  {
    id: 'CON-172',
    title: 'Laptop setup and printer troubleshooting',
    category: 'Technical Support',
    urgency: 'Low',
    status: 'In progress',
    distanceKm: 1.8,
    schedule: 'Saturday, 1:00 PM',
    budget: '₱900 - ₱1,400',
    location: 'Quezon City service zone',
    description: 'Need help connecting a home printer and transferring office files.',
    responseCount: 3
  }
]

export const nearbyWorkers: WorkerCardItem[] = [
  {
    id: 'W-14',
    name: 'Marco Santos',
    specialty: 'Residential plumber',
    rating: 4.9,
    completedJobs: 186,
    distanceKm: 2.1,
    availability: 'Available',
    verified: true,
    responseTime: 'Replies in 9 minutes',
    location: 'Makati service zone · 5 km coverage',
    note: 'Strong on urgent leaks, fixture replacement, and condominium maintenance.',
    tags: ['Leak repair', 'Pipe replacement', 'Condo ready']
  },
  {
    id: 'W-09',
    name: 'Elaine Dela Cruz',
    specialty: 'Electrical technician',
    rating: 4.8,
    completedJobs: 142,
    distanceKm: 3.6,
    availability: 'Busy',
    verified: true,
    responseTime: 'Usually replies within 18 minutes',
    location: 'Pasig and Mandaluyong service zone',
    note: 'Trusted for breaker diagnostics, rewiring, and switchboard work.',
    tags: ['Breaker issues', 'Lighting', 'Diagnostics']
  },
  {
    id: 'W-27',
    name: 'Kevin Navarro',
    specialty: 'IT support and setup',
    rating: 4.7,
    completedJobs: 91,
    distanceKm: 1.5,
    availability: 'Available',
    verified: true,
    responseTime: 'Replies in 7 minutes',
    location: 'Quezon City north service zone',
    note: 'Best for home-office setup, printers, and device troubleshooting.',
    tags: ['Printer setup', 'Laptop recovery', 'Network basics']
  }
]

export const structuredOffers: OfferItem[] = [
  {
    id: 'OFF-1',
    workerName: 'Marco Santos',
    specialty: 'Residential plumber',
    price: '₱1,900',
    eta: 'Within 45 minutes',
    schedule: 'Today, 7:15 PM',
    note: 'Can inspect the pressure issue, replace damaged fittings, and provide a final repair estimate on-site.',
    rating: 4.9,
    verified: true
  },
  {
    id: 'OFF-2',
    workerName: 'Ryan Velasco',
    specialty: 'Plumbing and maintenance',
    price: '₱1,650',
    eta: 'Within 1 hour',
    schedule: 'Today, 7:40 PM',
    note: 'Available after current booking. Includes leak patching and faucet inspection.',
    rating: 4.6,
    verified: true
  }
]

export const messageThreads: ThreadItem[] = [
  {
    id: 'TH-1',
    name: 'Marco Santos',
    role: 'Worker',
    specialty: 'Residential plumber',
    summary: 'I can be there before 7:30 PM. Please confirm parking access.',
    time: '2m ago',
    unread: 2,
    status: 'Offer sent',
    verified: true,
    online: true,
    concernId: 'CON-201',
    concernTitle: 'Kitchen sink leak with low water pressure'
  },
  {
    id: 'TH-2',
    name: 'Elaine Dela Cruz',
    role: 'Worker',
    specialty: 'Electrical technician',
    summary: 'For the breaker issue, can you send one more photo of the panel?',
    time: '18m ago',
    unread: 0,
    status: 'Awaiting photo',
    verified: true,
    online: false,
    concernId: 'CON-188',
    concernTitle: 'Breaker inspection and hallway light issue'
  },
  {
    id: 'TH-3',
    name: 'Kevin Navarro',
    role: 'Worker',
    specialty: 'IT support and setup',
    summary: 'I have completed the software setup. Printer test page next.',
    time: '41m ago',
    unread: 0,
    status: 'In progress',
    verified: true,
    online: true,
    concernId: 'CON-172',
    concernTitle: 'Laptop setup and printer troubleshooting'
  }
]

export const activeConversation: ChatMessage[] = [
  {
    id: 'MSG-1',
    sender: 'worker',
    body: 'I reviewed the photos. It looks like a sink trap leak plus possible faucet sediment buildup.',
    time: '6:58 PM'
  },
  {
    id: 'MSG-2',
    sender: 'client',
    body: 'That matches what we saw. Is tonight still possible? The cabinet is already damp.',
    time: '7:00 PM'
  },
  {
    id: 'MSG-3',
    sender: 'worker',
    body: 'Yes. I can arrive in 45 minutes and bring replacement fittings if needed.',
    time: '7:01 PM'
  }
]

export const conversationByThread: Record<string, ChatMessage[]> = {
  'TH-1': [
    {
      id: 'MSG-1',
      sender: 'worker',
      body: 'I reviewed the photos. It looks like a sink trap leak plus possible faucet sediment buildup.',
      time: '6:58 PM'
    },
    {
      id: 'MSG-2',
      sender: 'client',
      body: 'That matches what we saw. Is tonight still possible? The cabinet is already damp.',
      time: '7:00 PM'
    },
    {
      id: 'MSG-3',
      sender: 'worker',
      body: 'Yes. I can arrive in 45 minutes and bring replacement fittings if needed.',
      time: '7:01 PM'
    }
  ],
  'TH-2': [
    {
      id: 'MSG-4',
      sender: 'worker',
      body: 'I can inspect the panel tomorrow morning. One more breaker photo would help me confirm the likely issue.',
      time: '3:14 PM'
    },
    {
      id: 'MSG-5',
      sender: 'client',
      body: 'Understood. I will upload another photo tonight.',
      time: '3:18 PM'
    }
  ],
  'TH-3': [
    {
      id: 'MSG-6',
      sender: 'worker',
      body: 'The device transfer is complete. I am running the printer configuration now.',
      time: '1:35 PM'
    },
    {
      id: 'MSG-7',
      sender: 'client',
      body: 'Thank you. Let me know if I need to restart anything.',
      time: '1:37 PM'
    }
  ]
}

export const workerMetrics: MetricItem[] = [
  {
    label: 'Nearby open jobs',
    value: '15',
    helper: 'Filtered by plumbing, electrical, and IT support inside your radius.',
    tone: 'accent'
  },
  {
    label: 'Availability status',
    value: 'Available',
    helper: 'Your profile is visible to urgent job posts right now.',
    tone: 'success'
  },
  {
    label: 'Profile trust score',
    value: '4.9 / 5',
    helper: 'Built from verified status, reviews, and completion quality.',
    tone: 'info'
  },
  {
    label: 'Offers accepted this week',
    value: '06',
    helper: 'Strong conversion from quick structured responses.',
    tone: 'success'
  }
]

export const workerLeads: WorkerLead[] = [
  {
    id: 'LEAD-1',
    title: 'Leaking kitchen sink in condo unit',
    category: 'Plumbing',
    distanceKm: 2.4,
    budget: '₱1,500 - ₱2,300',
    urgency: 'Urgent',
    schedule: 'Today, 6:30 PM',
    location: 'Makati service zone'
  },
  {
    id: 'LEAD-2',
    title: 'Bathroom drain clog near Greenfield',
    category: 'Plumbing',
    distanceKm: 3.2,
    budget: '₱1,200 - ₱1,800',
    urgency: 'Normal',
    schedule: 'Tomorrow, 9:00 AM',
    location: 'Mandaluyong service zone'
  },
  {
    id: 'LEAD-3',
    title: 'Water heater installation check',
    category: 'Plumbing',
    distanceKm: 4.7,
    budget: '₱2,500 - ₱3,500',
    urgency: 'Low',
    schedule: 'Saturday, 3:00 PM',
    location: 'Taguig service zone'
  }
]

export const workerPortfolio = [
  {
    id: 'PORT-1',
    title: 'Condo kitchen line repair',
    description: 'Replaced corroded flex hose and sealed cabinet plumbing in a one-hour emergency callout.'
  },
  {
    id: 'PORT-2',
    title: 'Bathroom fixture refresh',
    description: 'Installed new faucet set and pressure-balanced valves for a Pasig townhouse renovation.'
  },
  {
    id: 'PORT-3',
    title: 'Emergency pipe isolation',
    description: 'Contained a burst under-sink pipe before cabinet damage spread to the adjacent unit.'
  }
]

export const workerVerificationChecklist = [
  'Valid government-issued ID',
  'Latest certification or trade proof',
  'Two recent portfolio images',
  'Updated service coverage radius',
  'Availability and response expectations'
]

export const adminMetrics: MetricItem[] = [
  {
    label: 'Pending worker reviews',
    value: '12',
    helper: 'Three submissions are waiting for document resubmission.',
    tone: 'warning'
  },
  {
    label: 'Flagged incidents',
    value: '04',
    helper: 'Two reports relate to missed appointments and one to abusive chat.',
    tone: 'danger'
  },
  {
    label: 'Verified workers live',
    value: '184',
    helper: 'Visible and matchable across all covered service categories.',
    tone: 'success'
  },
  {
    label: 'Median review completion',
    value: '4.8 hrs',
    helper: 'Average admin turnaround this week.',
    tone: 'info'
  }
]

export const verificationApplications: VerificationApplication[] = [
  {
    id: 'APP-440',
    name: 'Jessa Mendoza',
    specialty: 'Home electrician',
    submittedAt: 'Apr 4, 8:10 AM',
    coverage: 'Quezon City, 7 km radius',
    documents: ['National ID', 'TESDA certificate', '3 portfolio photos'],
    status: 'Under review',
    note: 'Profile is complete. Final check needed on certificate date consistency.'
  },
  {
    id: 'APP-438',
    name: 'Paolo Rivera',
    specialty: 'Aircon technician',
    submittedAt: 'Apr 4, 7:45 AM',
    coverage: 'Pasig and Mandaluyong, 5 km radius',
    documents: ['Driver license', 'Company badge', '4 portfolio photos'],
    status: 'Pending',
    note: 'Awaiting admin review. Strong portfolio but no standalone certification uploaded.'
  },
  {
    id: 'APP-432',
    name: 'Mia Torres',
    specialty: 'Private tutor',
    submittedAt: 'Apr 3, 4:18 PM',
    coverage: 'Taguig, Makati, 8 km radius',
    documents: ['Passport', 'Teaching certificate', '2 portfolio photos'],
    status: 'Rejected',
    note: 'Rejected for blurry ID upload. Can resubmit after updating document scans.'
  }
]

export const adminReports: ReportItem[] = [
  {
    id: 'REP-77',
    title: 'Worker missed scheduled urgent visit',
    severity: 'High',
    submittedBy: 'Client: Andrea P.',
    createdAt: 'Apr 4, 9:05 AM',
    reason: 'Worker accepted an urgent plumbing call and did not show up within the agreed time window.',
    status: 'Investigating'
  },
  {
    id: 'REP-75',
    title: 'Abusive language in chat thread',
    severity: 'High',
    submittedBy: 'Worker: Kevin N.',
    createdAt: 'Apr 3, 8:17 PM',
    reason: 'Client used repeated insulting language after quote negotiation failed.',
    status: 'Open'
  },
  {
    id: 'REP-69',
    title: 'Suspicious duplicate account',
    severity: 'Medium',
    submittedBy: 'System flag',
    createdAt: 'Apr 3, 1:30 PM',
    reason: 'Matching device pattern suggests the same worker profile may have been re-created after suspension.',
    status: 'Resolved'
  }
]

export const auditTrail = [
  'APP-440 escalated for certificate review after automated document scan mismatch.',
  'REP-75 chat transcript preserved and worker shielded from new assignments pending moderation.',
  'W-09 badge remains active after profile review confirmed ID and trade license validity.'
]

export const adminUsers: AdminUserItem[] = [
  {
    id: 'USR-101',
    name: 'Maria Santos',
    role: 'Client',
    status: 'Active',
    location: 'Makati City',
    joinedAt: 'Mar 12, 2026',
    note: 'Frequently posts home service jobs with fast worker selection.'
  },
  {
    id: 'USR-204',
    name: 'Marco Santos',
    role: 'Worker',
    status: 'Active',
    location: 'Makati service radius',
    joinedAt: 'Feb 28, 2026',
    note: 'Verified plumber with high completion rate and strong response speed.'
  },
  {
    id: 'USR-238',
    name: 'Paolo Rivera',
    role: 'Worker',
    status: 'Pending',
    location: 'Pasig and Mandaluyong',
    joinedAt: 'Apr 4, 2026',
    note: 'Application pending document review before worker visibility is enabled.'
  },
  {
    id: 'USR-075',
    name: 'Andrea Perez',
    role: 'Client',
    status: 'Suspended',
    location: 'Taguig City',
    joinedAt: 'Jan 19, 2026',
    note: 'Temporarily suspended after repeated abusive behavior in worker chat threads.'
  }
]

export const defaultConcernPin: MapPoint = {
  id: 'PIN-1',
  label: 'Makati service zone',
  lat: 14.5658,
  lng: 121.0339,
  kind: 'concern'
}

export const nearbyMapPoints: MapPoint[] = [
  {
    id: 'WM-1',
    label: 'Nearby plumber zone',
    lat: 14.5635,
    lng: 121.0275,
    kind: 'worker'
  },
  {
    id: 'WM-2',
    label: 'Nearby maintenance zone',
    lat: 14.5698,
    lng: 121.0398,
    kind: 'worker'
  },
  {
    id: 'WM-3',
    label: 'Nearby support zone',
    lat: 14.5718,
    lng: 121.0314,
    kind: 'worker'
  }
]
