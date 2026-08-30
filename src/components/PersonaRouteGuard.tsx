import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { usePersona } from '../context/PersonaContext';
import { DC_PURCHASING_PERSONAS, type FreshGuardPersona } from '../lib/trackingFlow';

const ALL_PERSONAS: FreshGuardPersona[] = [
  ...DC_PURCHASING_PERSONAS,
  'supplier',
  'transport',
  'receiving',
  'category_manager',
];

/** Paths restricted to specific personas (unlisted paths are open to all). */
const ROUTE_PERSONAS: Record<string, FreshGuardPersona[]> = {
  '/fruits-rfq': ['dc_purchasing_fruits'],
  '/orders': [...DC_PURCHASING_PERSONAS, 'supplier'],
  '/actions': ['dc_purchasing_fruits', 'transport', 'receiving', 'category_manager'],
  '/business-rules': [...DC_PURCHASING_PERSONAS],
  '/qc': [...DC_PURCHASING_PERSONAS, 'receiving'],
  '/claims': [...DC_PURCHASING_PERSONAS, 'supplier'],
};

const PERSONA_HOME: Record<FreshGuardPersona, string> = {
  dc_purchasing_fruits: '/fruits-rfq',
  dc_purchasing_vegetables: '/orders',
  supplier: '/orders',
  transport: '/',
  receiving: '/',
  category_manager: '/',
};

/**
 * Redirect when the active persona cannot access the current route
 * (e.g. supplier landing on /fruits-rfq after a persona switch).
 */
export function PersonaRouteGuard() {
  const { persona } = usePersona();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const allowed = ROUTE_PERSONAS[pathname];
    if (allowed && !allowed.includes(persona)) {
      navigate(PERSONA_HOME[persona] ?? '/', { replace: true });
    }
  }, [persona, pathname, navigate]);

  return null;
}

export { PERSONA_HOME, ROUTE_PERSONAS, ALL_PERSONAS };
