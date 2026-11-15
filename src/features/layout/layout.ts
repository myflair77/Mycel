export type Layout = 'desktop' | 'tablet' | 'phone';
export type LayoutPreference = Layout | 'auto';
export function parsePreference(value: string | null): LayoutPreference { return value === 'desktop' || value === 'tablet' || value === 'phone' ? value : 'auto'; }
export function resolveLayout(preference: LayoutPreference, width: number): Layout { return preference !== 'auto' ? preference : width < 600 ? 'phone' : width < 1100 ? 'tablet' : 'desktop'; }
