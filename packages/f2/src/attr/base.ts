import { Scale } from '@antv/scale';
import { mix, isFunction, isNil, isArray } from '@antv/util';
import { values as arrayValues } from '../util/array';

class Base {
  data: any;
  field: string;
  scale: Scale;
  range: any[];
  map: Function;

  constructor(options) {
    mix(this, options);

    const { scale, field, data } = this;
    if (!scale && data) {
      const values = arrayValues(data, field);
      this.scale = this.createScale({ values });
    }
  }

  createScale(scale): Scale {
    return null;
  }

  // 数据映射方法
  _mapping(value): any {
    return value;
  }

  // 数据映射方法
  mapping(value): any {
    const rst = isFunction(this.map) ? this.map(value) : null;
    if (!isNil(rst)) {
      return rst;
    }
    return this._mapping(value);
  }

  update(options) {
    mix(this, options);
  }

  setRange(range) {
    this.range = range;
  }

  normalize(value: any) {
    const { scale } = this;

    if (isArray(value)) {
      return value.map((v) => {
        return scale.scale(v);
      });
    }
    return scale.scale(value);
  }

  convert(value) {
    return value;
  }
}

export default Base;