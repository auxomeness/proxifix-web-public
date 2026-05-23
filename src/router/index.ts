import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { roleDestinations } from '@/data/mockData'

import AppShell from '@/components/layout/AppShell.vue'
import AuthView from '@/views/AuthView.vue'
import ClientProfileView from '@/views/client/ClientProfileView.vue'
import LandingView from '@/views/LandingView.vue'
import ForgotPasswordView from '@/views/ForgotPasswordView.vue'
import ResetPasswordView from '@/views/ResetPasswordView.vue'
import ClientOverviewView from '@/views/client/ClientOverviewView.vue'
import ClientConcernsView from '@/views/client/ClientConcernsView.vue'
import ClientOffersView from '@/views/client/ClientOffersView.vue'
import ClientHireView from '@/views/client/ClientHireView.vue'
import ClientWorkersView from '@/views/client/ClientWorkersView.vue'
import ClientSavedWorkersView from '@/views/client/ClientSavedWorkersView.vue'
import ClientMessagesView from '@/views/client/ClientMessagesView.vue'
import ClientHistoryView from '@/views/client/ClientHistoryView.vue'
import ClientWorkerProfileView from '@/views/client/ClientWorkerProfileView.vue'
import InfoPageView from '@/views/InfoPageView.vue'
import WorkerOverviewView from '@/views/worker/WorkerOverviewView.vue'
import WorkerJobsView from '@/views/worker/WorkerJobsView.vue'
import WorkerOffersView from '@/views/worker/WorkerOffersView.vue'
import WorkerHireRequestsView from '@/views/worker/WorkerHireRequestsView.vue'
import WorkerMessagesView from '@/views/worker/WorkerMessagesView.vue'
import WorkerHistoryView from '@/views/worker/WorkerHistoryView.vue'
import WorkerProfileView from '@/views/worker/WorkerProfileView.vue'
import WorkerClientProfileView from '@/views/worker/WorkerClientProfileView.vue'
import AdminOverviewView from '@/views/admin/AdminOverviewView.vue'
import AdminVerificationView from '@/views/admin/AdminVerificationView.vue'
import AdminVerificationDetailView from '@/views/admin/AdminVerificationDetailView.vue'
import AdminReportsView from '@/views/admin/AdminReportsView.vue'
import AdminUsersView from '@/views/admin/AdminUsersView.vue'
import WorkspaceSettingsView from '@/views/WorkspaceSettingsView.vue'
import { pinia } from '@/plugins/pinia'
import { useSessionStore } from '@/stores/session'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'landing',
    component: LandingView,
    meta: {
      title: 'ProxiFix',
      description: 'Web-first service coordination for clients, workers, and admins.'
    }
  },
  {
    path: '/login',
    name: 'login',
    component: AuthView,
    meta: {
      title: 'Sign in',
      description: 'Access your client or worker account.'
    }
  },
  {
    path: '/auth/admin/login',
    name: 'admin-login',
    component: AuthView,
    meta: {
      title: 'Admin sign in',
      description: 'Access the ProxiFix admin account.'
    }
  },
  {
    path: '/register',
    name: 'register',
    component: AuthView,
    meta: {
      title: 'Create account',
      description: 'Create a ProxiFix account as a client or worker.'
    }
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: ForgotPasswordView,
    meta: {
      title: 'Forgot password',
      description: 'Request a reset link to recover access to your ProxiFix account.'
    }
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: ResetPasswordView,
    meta: {
      title: 'Reset password',
      description: 'Enter your reset token and choose a new account password.'
    }
  },
  {
    path: '/privacy-policy',
    name: 'privacy-policy',
    component: InfoPageView,
    meta: {
      title: 'Privacy Policy',
      infoType: 'privacy'
    }
  },
  {
    path: '/terms-and-conditions',
    name: 'terms-and-conditions',
    component: InfoPageView,
    meta: {
      title: 'Terms and Conditions',
      infoType: 'terms'
    }
  },
  {
    path: '/about-us',
    name: 'about-us',
    component: InfoPageView,
    meta: {
      title: 'About Us',
      infoType: 'about'
    }
  },
  {
    path: '/contact-support',
    name: 'contact-support',
    component: InfoPageView,
    meta: {
      title: 'Contact Support',
      infoType: 'contact'
    }
  },
  {
    path: '/app/client',
    component: AppShell,
    meta: {
      role: 'client'
    },
    children: [
      {
        path: '',
        redirect: '/app/client/overview'
      },
      {
        path: 'overview',
        name: 'client-overview',
        component: ClientOverviewView,
        meta: {
          title: 'Dashboard',
          description: 'See open jobs, offers, workers, and the next action that matters.',
          actionLabel: 'Post job',
          actionTo: '/app/client/concerns'
        }
      },
      {
        path: 'concerns',
        name: 'client-concerns',
        component: ClientConcernsView,
        meta: {
          title: 'Jobs',
          description: 'Create, edit, and track the jobs you posted.',
          actionLabel: 'Browse workers',
          actionTo: '/app/client/workers'
        }
      },
      {
        path: 'workers',
        name: 'client-workers',
        component: ClientWorkersView,
        meta: {
          title: 'Workers',
          description: 'Browse verified professionals by distance, rating, and specialty.',
          actionLabel: 'Open inbox',
          actionTo: '/app/client/messages'
        }
      },
      {
        path: 'saved-workers',
        name: 'client-saved-workers',
        component: ClientSavedWorkersView,
        meta: {
          title: 'Saved',
          description: 'Manage the workers you saved for future hiring and fast rebooking.',
          actionLabel: 'Browse workers',
          actionTo: '/app/client/workers'
        }
      },
      {
        path: 'offers',
        name: 'client-offers',
        component: ClientOffersView,
        meta: {
          title: 'Offers',
          description: 'Compare quotes, schedules, and offer statuses in one queue.',
          actionLabel: 'Open inbox',
          actionTo: '/app/client/messages'
        }
      },
      {
        path: 'hire',
        name: 'client-hire',
        component: ClientHireView,
        meta: {
          title: 'Hires',
          description: 'Track direct hires and selected workers from job request to completion.',
          actionLabel: 'Workers',
          actionTo: '/app/client/workers'
        }
      },
      {
        path: 'messages',
        name: 'client-messages',
        component: ClientMessagesView,
        meta: {
          title: 'Messages',
          description: 'Keep worker conversations and offer follow-up in one place.',
          actionLabel: 'Workers',
          actionTo: '/app/client/workers'
        }
      },
      {
        path: 'history',
        name: 'client-history',
        component: ClientHistoryView,
        meta: {
          title: 'History',
          description: 'Review recent account activity and manage recently deleted jobs.',
          actionLabel: 'Open jobs',
          actionTo: '/app/client/concerns'
        }
      },
      {
        path: 'profile',
        name: 'client-profile',
        component: ClientProfileView,
        meta: {
          title: 'Profile',
          description: 'Manage your account details, saved workers, reviews, and preferences.',
          actionLabel: 'Open jobs',
          actionTo: '/app/client/concerns'
        }
      },
      {
        path: 'workers/:workerId/profile',
        name: 'client-worker-profile',
        component: ClientWorkerProfileView,
        meta: {
          title: 'Worker profile',
          description: 'View worker ratings and service history before hiring.',
          actionLabel: 'Back to workers',
          actionTo: '/app/client/workers'
        }
      },
      {
        path: 'settings',
        name: 'client-settings',
        component: WorkspaceSettingsView,
        meta: {
          title: 'Settings',
          description: 'Control theme and account display preferences.',
          actionLabel: 'Dashboard',
          actionTo: '/app/client/overview'
        }
      }
    ]
  },
  {
    path: '/app/worker',
    component: AppShell,
    meta: {
      role: 'worker'
    },
    children: [
      {
        path: '',
        redirect: '/app/worker/overview'
      },
      {
        path: 'overview',
        name: 'worker-overview',
        component: WorkerOverviewView,
        meta: {
          title: 'Dashboard',
          description: 'Stay on top of nearby demand, availability, and trust metrics.',
          actionLabel: 'Open jobs',
          actionTo: '/app/worker/jobs'
        }
      },
      {
        path: 'jobs',
        name: 'worker-jobs',
        component: WorkerJobsView,
        meta: {
          title: 'Jobs',
          description: 'Review leads, send structured offers, and manage active work.',
          actionLabel: 'My offers',
          actionTo: '/app/worker/offers'
        }
      },
      {
        path: 'offers',
        name: 'worker-offers',
        component: WorkerOffersView,
        meta: {
          title: 'Offers',
          description: 'Manage quotes, timing, and structured notes already sent to clients.',
          actionLabel: 'Open jobs',
          actionTo: '/app/worker/jobs'
        }
      },
      {
        path: 'hire-requests',
        name: 'worker-hire-requests',
        component: WorkerHireRequestsView,
        meta: {
          title: 'Hire requests',
          description: 'Track jobs where clients selected your offer and prepare execution.',
          actionLabel: 'Messages',
          actionTo: '/app/worker/messages'
        }
      },
      {
        path: 'messages',
        name: 'worker-messages',
        component: WorkerMessagesView,
        meta: {
          title: 'Messages',
          description: 'Coordinate directly with clients after interest or offer submission.',
          actionLabel: 'Open offers',
          actionTo: '/app/worker/offers'
        }
      },
      {
        path: 'history',
        name: 'worker-history',
        component: WorkerHistoryView,
        meta: {
          title: 'History',
          description: 'Review recent lead actions, offer movement, and account-side activity.',
          actionLabel: 'Offers',
          actionTo: '/app/worker/offers'
        }
      },
      {
        path: 'profile',
        name: 'worker-profile',
        component: WorkerProfileView,
        meta: {
          title: 'Profile',
          description: 'Maintain your verification record, portfolio, and coverage settings.',
          actionLabel: 'Open jobs',
          actionTo: '/app/worker/jobs'
        }
      },
      {
        path: 'clients/:clientId/profile',
        name: 'worker-client-profile',
        component: WorkerClientProfileView,
        meta: {
          title: 'Client profile',
          description: 'Review client ratings and request history before accepting work.',
          actionLabel: 'Back to jobs',
          actionTo: '/app/worker/jobs'
        }
      },
      {
        path: 'settings',
        name: 'worker-settings',
        component: WorkspaceSettingsView,
        meta: {
          title: 'Settings',
          description: 'Control theme and account display preferences.',
          actionLabel: 'Dashboard',
          actionTo: '/app/worker/overview'
        }
      }
    ]
  },
  {
    path: '/app/admin',
    component: AppShell,
    meta: {
      role: 'admin'
    },
    children: [
      {
        path: '',
        redirect: '/app/admin/overview'
      },
      {
        path: 'overview',
        name: 'admin-overview',
        component: AdminOverviewView,
        meta: {
          title: 'Dashboard',
          description: 'Track platform integrity, verification throughput, and issue volume.',
          actionLabel: 'Review queue',
          actionTo: '/app/admin/verification'
        }
      },
      {
        path: 'verification',
        name: 'admin-verification',
        component: AdminVerificationView,
        meta: {
          title: 'Verification',
          description: 'Approve workers, review documents, and manage resubmissions.',
          actionLabel: 'View reports',
          actionTo: '/app/admin/reports'
        }
      },
      {
        path: 'verification/:applicationId',
        name: 'admin-verification-detail',
        component: AdminVerificationDetailView,
        meta: {
          title: 'Application review',
          description: 'Inspect one worker submission in detail before approving visibility.',
          actionLabel: 'Back to queue',
          actionTo: '/app/admin/verification'
        }
      },
      {
        path: 'reports',
        name: 'admin-reports',
        component: AdminReportsView,
        meta: {
          title: 'Reports',
          description: 'Handle complaints, suspensions, and platform policy enforcement.',
          actionLabel: 'Verification queue',
          actionTo: '/app/admin/verification'
        }
      },
      {
        path: 'users',
        name: 'admin-users',
        component: AdminUsersView,
        meta: {
          title: 'Users',
          description: 'Search accounts, review profiles, and control client and worker access.',
          actionLabel: 'Open reports',
          actionTo: '/app/admin/reports'
        }
      },
      {
        path: 'settings',
        name: 'admin-settings',
        component: WorkspaceSettingsView,
        meta: {
          title: 'Settings',
          description: 'Control theme and console display preferences.',
          actionLabel: 'Dashboard',
          actionTo: '/app/admin/overview'
        }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to) => {
  const sessionStore = useSessionStore(pinia)

  if (!sessionStore.hydrated) {
    await sessionStore.hydrateSession()
  }

  const currentUser = sessionStore.currentUser
  const requiresAppSession = to.path.startsWith('/app/')
  const isAuthRoute =
    to.name === 'login' || to.name === 'register' || to.name === 'admin-login'
  const targetRole = typeof to.meta.role === 'string' ? to.meta.role : null

  if (requiresAppSession && !currentUser) {
    if (to.path.startsWith('/app/admin')) {
      return '/auth/admin/login'
    }

    if (to.path.startsWith('/app/worker')) {
      return '/login?portal=worker'
    }

    return '/login?portal=client'
  }

  if (
    requiresAppSession &&
    currentUser &&
    !currentUser.profileCompleted &&
    to.name !== `${currentUser.role}-profile` &&
    to.name !== `${currentUser.role}-settings`
  ) {
    return `${roleDestinations[currentUser.role].replace('/overview', '/profile')}?setup=1`
  }

  if (requiresAppSession && currentUser && targetRole && currentUser.role !== targetRole) {
    return roleDestinations[currentUser.role]
  }

  if (isAuthRoute && currentUser) {
    return roleDestinations[currentUser.role]
  }

  return true
})

router.afterEach((to) => {
  if (typeof document !== 'undefined') {
    document.title = `${String(to.meta.title ?? 'ProxiFix')} | ProxiFix`
  }
})

export default router
