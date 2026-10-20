import { useEffect, useMemo, useState } from 'react';
import { cachedPhotoFraming, photoFramingRequest, requestPhotoFraming } from '../utils/photo-framing.js';

export function usePhotoFraming(slides, fmt) {
  const [version, setVersion] = useState(0);
  const requests = useMemo(() => slides.map(slide => photoFramingRequest(slide, fmt)), [slides, fmt]);
  useEffect(() => {
    let active = true;
    const pending = requests.filter(request => request && !cachedPhotoFraming(request)?.ready);
    for (const request of pending) {
      requestPhotoFraming(request).then(() => { if (active) setVersion(v => v + 1); });
    }
    return () => { active = false; };
  }, [requests]);
  return useMemo(() => slides.map((slide, index) => {
    const request = requests[index];
    if (!request) return slide;
    const result = cachedPhotoFraming(request);
    return {
      ...slide,
      ...(result?.position || {}),
      autoPhotoPending: !result?.ready,
    };
  }), [slides, requests, version]);
}
