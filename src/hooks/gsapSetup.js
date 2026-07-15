import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

/**
 * Ponto único de registro dos plugins GSAP usados na landing (ScrollTrigger +
 * SplitText, ambos gratuitos desde o GSAP 3.13). Import isso em vez de 'gsap'
 * direto sempre que precisar de ScrollTrigger/SplitText, pra garantir que o
 * registerPlugin já rodou.
 */
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger, SplitText);
}

export { gsap, ScrollTrigger, SplitText };
