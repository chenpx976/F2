import { render, renderJSXElement, compareRenderTree } from '../jsx';
import { isArray, isUndefined } from '@antv/util';
import Component from './component';
import equal from './equal';
import createComponentTree from './createComponentTree';
import Children from '../children';

function renderShape(
  component: Component,
  children: JSX.Element,
  animate?: boolean
) {
  // @ts-ignore
  const { container, __lastElement, context } = component;
  // 先清空绘制内容
  container.clear();

  // children 是 shape 的 jsx 结构, component.render() 返回的结构
  const shapeElement = renderJSXElement(children, { context });
  // @ts-ignore
  component.__lastElement = shapeElement;
  const renderElement =
    animate !== false
      ? compareRenderTree(shapeElement, __lastElement)
      : shapeElement;
  if (!renderElement) return null;
  // 生成G的节点树, 存在数组的情况是根节点有变化，之前的树删除，新的树创建
  if (isArray(renderElement)) {
    return renderElement.map(element => {
      return render(element, container);
    });
  } else {
    return render(renderElement, container);
  }
}

function createComponent(parent: Component, element: JSX.Element): Component {
  const { type, props, key, ref } = element;
  const { container, context, updater } = parent;
  // 这里 一定是 F2 Component 了
  // @ts-ignore
  const component = new type(props, context, updater);

  // 设置ref
  if (ref) {
    ref.current = component;
  }

  // 每个组件都新建一个独立容器
  component.container = container.addGroup();
  component.context = context;
  component.updater = updater;

  return component;
}

function renderComponent(component: Component | Component[]) {
  Children.map(component, (item: Component) => {
    const { children: lastChildren } = item;
    const mount = isUndefined(lastChildren);
    if (mount) {
      if (item.willMount) item.willMount();
    } else if (item.willUpdate) {
      item.willUpdate();
    }
  });

  Children.map(component, (item: Component) => {
    const { children: lastChildren } = item;
    const mount = isUndefined(lastChildren);
    let newChildren = item.render();
    renderChildren(item, newChildren, lastChildren);
    if (mount) {
      if (item.didMount) item.didMount();
    } else if (item.didUpdate) {
      item.didUpdate();
    }
  });
}

function destroyElement(elements: JSX.Element) {
  Children.map(elements, element => {
    if (!element) return;
    const { component } = element;
    if (!component) {
      return;
    }
    if (component.willUnmount) {
      component.willUnmount();
    }
    destroyElement(component.element);
    const { container } = component;
    container.remove(true);
    if (component.didUnmount) {
      component.didUnmount();
    }
  });
}

function diffElement(nextElement: JSX.Element, lastElement: JSX.Element) {
  if (!nextElement && !lastElement) {
    return null;
  }
  // 新建
  if (nextElement && !lastElement) {
    return nextElement;
  }

  // 删除
  if (!nextElement && lastElement) {
    destroyElement(lastElement);
    return null;
  }

  // diff
  const { type: nextType, props: nextProps } = nextElement;
  const { type: lastType, props: lastProps, component } = lastElement;

  if (nextType !== lastType) {
    destroyElement(lastElement);
    return nextElement;
  }

  if (equal(nextProps, lastProps)) {
    return null;
  }

  // 保留component， 等下一阶段处理
  nextElement.component = component;
  return nextElement;
}
function diff(parent: Component, nextChildren, lastChildren) {
  // destroy
  // 生命周期的几个阶段
  // should create / update
  // create / Receive props
  // willMount / willUpdate
  // render
  // didMount / didUpdate

  let childrenArray = [];
  // 1. 第一轮比较， 直接destroy的元素处理掉，destroy 的元素不需要进入下一阶段
  Children.compare(nextChildren, lastChildren, (next, last) => {
    const element = diffElement(next, last);

    if (element) {
      childrenArray = childrenArray.concat(
        Children.toArray(element).filter(Boolean)
      );
    }
  });
  // 2. 处理 shouldCreate 和 shouldUpdate
  const shouldProcessChildren = childrenArray.filter((element: JSX.Element) => {
    const { component, props } = element;
    // 说明是新增的元素，需要新建
    if (!component) return true;
    // 不需要更新
    if (component.shouldUpdate && component.shouldUpdate(props) === false) {
      return false;
    }
    return true;
  });
  // 3. 处理 create 和 Receive props
  const shouldRenderComponnet = shouldProcessChildren.map(
    (element: JSX.Element) => {
      const { component, props } = element;
      if (!component) {
        element.component = createComponent(parent, element);
      } else if (component.willReceiveProps) {
        component.willReceiveProps(props);
        component.props = props;
      }
      return element.component;
    }
  );

  // 4. 处理 render
  renderComponent(shouldRenderComponnet);

  // 按子组件顺序渲染内容
  childrenArray.forEach((element: JSX.Element) => {
    const { component } = element;
    const { container: parentGroup } = parent;
    parentGroup.add(component.container);
  });

  return nextChildren;
}

function isContainer(children: JSX.Element) {
  if (!children) return false;
  if (!isArray(children)) {
    const { type } = children;
    // @ts-ignore
    return type.prototype && type.prototype.isF2Component;
  }
  return isContainer(children[0]);
}

function renderChildren(parent: Component, nextChildren, lastChildren) {
  const { context } = parent;
  let newChildren = createComponentTree(nextChildren, { context });
  parent.children = newChildren;
  if (isContainer(newChildren)) {
    newChildren = diff(parent, newChildren, lastChildren);
  } else {
    renderShape(parent, nextChildren, true);
  }
  return newChildren;
}

export { renderChildren, diff, renderComponent, renderShape };
