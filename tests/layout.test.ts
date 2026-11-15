import {describe,it,expect} from 'vitest';
import {parsePreference,resolveLayout} from '../src/features/layout/layout';
describe('layout across window resizing and overrides',()=>{
 it.each([[320,'phone'],[344,'phone'],[599,'phone'],[600,'tablet'],[690,'tablet'],[700,'tablet'],[884,'tablet'],[1099,'tablet'],[1100,'desktop'],[1920,'desktop']] as const)('auto at %i CSS pixels is %s',(width,expected)=>expect(resolveLayout('auto',width)).toBe(expected));
 it('keeps a manual override while resizing',()=>{for(const width of [320,884,1920]){expect(resolveLayout('desktop',width)).toBe('desktop');expect(resolveLayout('phone',width)).toBe('phone');expect(resolveLayout('tablet',width)).toBe('tablet')}});
 it('recovers from an invalid stored preference',()=>{expect(parsePreference('invalid')).toBe('auto');expect(parsePreference(null)).toBe('auto')});
});
