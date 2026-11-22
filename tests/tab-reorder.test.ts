import {it,expect} from 'vitest';
import {normalizeResourceOrder,resourceOrderKey} from '../src/components/ResourceTabs';
import {tabDropIndex} from '../src/components/tabDrag';
it('repairs stored tab order and isolates each user preference',()=>{expect(normalizeResourceOrder(['note','note','unknown','chat'])).toEqual(['note','chat','event']);expect(normalizeResourceOrder(null)).toEqual(['event','note','chat']);expect(resourceOrderKey('one')).not.toBe(resourceOrderKey('two'))});
it('locates a drag destination with unequal tab widths and clamps outside the bar',()=>{expect(tabDropIndex(-20,[30,120,250])).toBe(0);expect(tabDropIndex(140,[30,120,250])).toBe(1);expect(tabDropIndex(300,[30,120,250])).toBe(2)});
