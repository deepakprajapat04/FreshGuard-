import { createContext, useContext, useState, ReactNode } from 'react';
import type { FreshGuardPersona } from '../lib/trackingFlow';

export type Persona = FreshGuardPersona;

interface PersonaContextType {
  persona: Persona;
  setPersona: (p: Persona) => void;
}

const PersonaContext = createContext<PersonaContextType | undefined>(undefined);

export function PersonaProvider({ children }: { children: ReactNode }) {
  const [persona, setPersona] = useState<Persona>('dc_purchasing');
  return (
    <PersonaContext.Provider value={{ persona, setPersona }}>
      {children}
    </PersonaContext.Provider>
  );
}

export function usePersona() {
  const context = useContext(PersonaContext);
  if (!context) throw new Error('usePersona must be used within PersonaProvider');
  return context;
}

/** Supplier portal — sees own POs only. */
export function isSupplierPersona(persona: Persona) {
  return persona === 'supplier';
}

/** Internal DC / ops personas (not supplier). */
export function isInternalPersona(persona: Persona) {
  return persona !== 'supplier';
}

/** Can approve risk-action proposals. */
export function canApproveActions(persona: Persona) {
  return persona === 'dc_purchasing';
}
