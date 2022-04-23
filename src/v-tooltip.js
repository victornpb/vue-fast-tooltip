/**
 * High performance tooltips
 *
 * This is a simple alternative to Vuetify <v-tooltip> component
 * which is pretty verbose and render intensive
 *
 * At this point this implementation is very simple
 *
 * Usage:
 * <Element v-tooltip="'Hello World'">
 * or
 * <Element title="Lorem ipsum" v-tooltip>
 *
 * @author https://github.com/victornpb
 */

const DIRECTIVE = 'tooltip';

const bindingsMap = new WeakMap(); // store nodes using the directive, HTMLDocument as key
const cachedTooltipElms = new WeakMap(); // the actual tooltip elements, one per document

const scrollingTooltipElms = new Set();
const ENABLE_SCROLL_HANDLER = true;

/**
 * Creates the actual tooltip element
 * at this point it is not appended to the document.
 * @param {Document} doc - the document to create the tooltip element in
 * @returns {HTMLElement} - the tooltip element
 */
function newTooltipElm(doc = document) {
  const style = `
     position: fixed;
     z-index: 9999999;
     pointer-events: none;
     
     will-change: top, left, opacity;
     --transition: opacity 250ms ease 100ms;
 
     font-size: 12px;
     padding: 5px 8px;
     border-radius: 2px;
     background: rgb(37, 37, 37, 0.85);
     color: #fff;
     -webkit-box-shadow: 0 3px 1px -2px rgb(0 0 0 / 20%), 0 2px 2px 0 rgb(0 0 0 / 14%), 0 1px 5px 0 rgb(0 0 0 / 12%);
     box-shadow: 0 3px 1px -2px rgb(0 0 0 / 20%), 0 2px 2px 0 rgb(0 0 0 / 14%), 0 1px 5px 0 rgb(0 0 0 / 12%);
 
     top: 0;
     left: 0;
     opacity: 0;
     display: none;
   `;

  const tooltipElm = doc.createElement('div');
  tooltipElm.setAttribute('class', `v-${DIRECTIVE}-directive`);
  tooltipElm.style.cssText = style;

  // ARIA https://www.w3.org/TR/wai-aria-practices-1.1/#tooltip
  tooltipElm.id = `id_${Math.random()}`;
  tooltipElm.setAttribute('role', 'tooltip');
  tooltipElm.setAttribute('aria-hidden', 'true');

  return tooltipElm;
}

/**
 * Get the tooltip element for a given document
 * This function will reuse the tooltip element if it already exists
 * @param {Document} doc - the document to create the tooltip element in
 * @returns {HTMLElement} - the tooltip element
 */
function grabTooltip(doc = document) {
  const cachedTooltip = cachedTooltipElms.get(doc);
  if (cachedTooltip) {
    if (cachedTooltip.parentNode) return cachedTooltip;
    else cachedTooltipElms.delete(doc);
  }
  const tooltipElm = newTooltipElm(doc);
  const rootElement = () => doc.querySelector('#app, [data-app="true"]') || doc.body;
  rootElement().appendChild(tooltipElm);
  cachedTooltipElms.set(doc, tooltipElm); // cache this tooltip for this document
  return tooltipElm;
}

/**
 * Show the tooltip of a particular element
 * it will lazily create a tooltipElement or reuse an existing one
 * It will smartly position it relative to the element ensuring it within the viewport
 */
function showTooltip(el, binding) {

  const data = binding.data;

  // use the title attribute as fallback for the value
  // store it in a data attribute so
  if (!data.value && el.hasAttribute('title')) {
    el.setAttribute('data-tooltip', el.getAttribute('title'));
    el.removeAttribute('title'); // remove title so it doesn't have native tooltips
  }

  // Create a tooltip element or reuse the previous one
  const doc = el.ownerDocument;
  const tooltipElm = binding.tooltipElm ?? grabTooltip(doc);
  binding.tooltipElm = tooltipElm; // store reference so we can hide it directly

  // The tooltip is already in the document, but not visible.
  // It needs to be be a block, and be inside the screen for it to have dimensions.
  // Since we reuse tooltips, if the content changes, and it overflows off-screen,
  // the computed styles will not match when placed in the the real posision.
  tooltipElm.style.display = 'block';
  tooltipElm.style.top = `${0}px`;
  tooltipElm.style.left = `${0}px`;
  tooltipElm.innerText = data.value ?? el.getAttribute('data-tooltip');

  // Get dimensions and positioning of target and tooltip
  const tooltipRect = tooltipElm.getBoundingClientRect();
  const targetRect = el.getBoundingClientRect();

  // set tooltip on top center of target
  let y = targetRect.top - binding.margin - tooltipRect.height;
  let x = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;

  // is tooltip above screen? move it below the target
  if (y < 0) y = targetRect.bottom + binding.margin;
  // is tooltip-left-side off screen? align with target-left-side
  if (x < 0) x = targetRect.left;
  // is tooltip-right-side off screen? align with target-right-side
  const vw = Math.max(doc.documentElement.clientWidth || 0, window.innerWidth || 0);
  if (x + tooltipRect.width > vw) x = targetRect.right - tooltipRect.width;

  // place the tooltip position to the x,y calculated
  tooltipElm.style.left = `${x}px`;
  tooltipElm.style.top = `${y}px`;

  // ARIA https://www.w3.org/TR/wai-aria-practices-1.1/#tooltip
  el.setAttribute('aria-describedby', tooltipElm.id);
  tooltipElm.setAttribute('aria-hidden', 'false');

  // Show tooltip
  tooltipElm.style.opacity = 1;
  binding.isVisible = true;

  return tooltipElm;
}

function hideTooltip(el, data) {
  const tooltipElm = data.tooltipElm;
  if (tooltipElm !== undefined && tooltipElm.parentNode) {
    tooltipElm.style.display = 'none';
    tooltipElm.style.opacity = 0;
    tooltipElm.setAttribute('aria-hidden', 'true');
    el.removeAttribute('aria-describedby');
  } else {
    // tooltip element removed from the DOM
  }
  data.tooltipElm = undefined;
  data.isVisible = false;
}

function handlerHover(_event) {
  const el = this;
  const data =  bindingsMap.get(el);
  if (!data.isVisible) {
    data.tooltipElm = showTooltip(el, data);
    el.addEventListener('mouseleave', handlerLeave, { passive: true, once: true });
    el.addEventListener('blur', handlerLeave, { passive: true, once: true });
    document.addEventListener('scroll', handleScroll, { passive: true });
  }
}

function handlerLeave(_event) {
  const el = this;
  const data =  bindingsMap.get(el);
  if (data.isVisible) {
    hideTooltip(el, data);
    el.removeEventListener('mouseleave', handlerLeave, { passive: true });
    el.removeEventListener('blur', handlerLeave, { passive: true });
  }
}

function handleScroll(_event) {
  const el = this;
  const data = bindingsMap.get(el);
  if (data.isVisible) {
    showTooltip(el, data);
  }
}

function newBinding(data) {
  return {
    isVisible: false,
    margin: 5,
    tooltipElm: undefined,
    data: data,
  };
}

export default {
  bind(el, data) {
    bindingsMap.set(el, newBinding(data));
    el.addEventListener('mouseenter', handlerHover, { passive: true});
    el.addEventListener('focus', handlerHover, { passive: true});
  },
  update(el, data) {
    const binding =  bindingsMap.get(el);
    binding.data = data;
    if (binding.isVisible) showTooltip(el, binding);
  },
  unbind(el, _data) {
    const data =  bindingsMap.get(el);
    if (data.isVisible) hideTooltip(el, data);

    // cleanup event listeners
    el.removeEventListener('mouseenter', handlerHover, { passive: true });
    el.removeEventListener('focus', handlerHover, { passive: true });
    el.removeEventListener('mouseleave', handlerLeave, { passive: true });
    el.removeEventListener('blur', handlerLeave, { passive: true });

    bindingsMap.delete(el);
  },
};
