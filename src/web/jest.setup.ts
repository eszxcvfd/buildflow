/**
 * Jest DOM stubs for Ark UI (floating-ui positioning) under jsdom.
 * ResizeObserver / IntersectionObserver do not exist in jsdom; Ark's
 * Menu/Select/Dialog positioners only need them to exist, layout values
 * are irrelevant for behavior tests.
 */
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof window !== 'undefined') {
  if (!('ResizeObserver' in window)) {
    (window as unknown as Record<string, unknown>).ResizeObserver = NoopObserver;
  }
  if (!('IntersectionObserver' in window)) {
    (window as unknown as Record<string, unknown>).IntersectionObserver = NoopObserver;
  }
  if (!('matchMedia' in window)) {
    (window as unknown as Record<string, unknown>).matchMedia = () => ({
      matches: false,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
  if (window.HTMLElement && !window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = function scrollIntoViewStub() {};
  }
  if (window.Element) {
    if (!window.Element.prototype.scrollTo) {
      window.Element.prototype.scrollTo = function scrollToStub() {};
    }
    if (!window.Element.prototype.scrollBy) {
      window.Element.prototype.scrollBy = function scrollByStub() {};
    }
  }
  // zag focus-trap checks CSS.supports / CSS.escape; jsdom has no CSS object.
  if (!('CSS' in window)) {
    (window as unknown as Record<string, unknown>).CSS = {
      escape: (v: string) => v,
      supports: () => false,
    };
  }
}

export {};
