import { createContext, useContext, useState, ReactNode } from 'react';
import {
  type FreshGuardPersona,
  isDcPurchasingPersona,
} from '../lib/trackingFlow';

export type Persona = FreshGuardPersona;

interface PersonaContextType {
  persona: Persona;
  setPersona: (p: Persona) => void;
}

const PersonaContext = createContext<PersonaContextType | undefined>(undefined);

export function PersonaProvider({ children }: { children: ReactNode }) {
  const [persona, setPersona] = useState<Persona>('dc_purchasing_fruits');
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

/** True if persona is a DC buyer lane. Use canPersonaApproveAction(action, persona) per action. */
export function canApproveActions(persona: Persona) {
  return isDcPurchasingPersona(persona);
}

/** Can approve promotion proposals (Category Manager — step 2). */
export function canApproveCategoryActions(persona: Persona) {
  return persona === 'category_manager';
}

export { isDcPurchasingPersona };
