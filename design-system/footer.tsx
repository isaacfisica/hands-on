import {  footerSocials, profile } from '@/lib/data';
import { LinkIcon } from './icons';

export function Footer(){
            {/* ───────── FOOTER ───────── */}
        return <div className="footer ">
          <svg className="footer__wave" viewBox="0 0 460 14" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 7 H180 l5 -4 l5 8 l5 -8 l5 4 H280 C 320 7 320 11 460 7" fill="none" stroke="var(--copper)" strokeWidth={1.2} strokeLinejoin="round" strokeLinecap="round" />
          </svg>
          <div className="footer__inner">
            <div className="footer__socials">
              {footerSocials.map((s) => (
                <a href={s.url} target="_blank" rel="noopener noreferrer" aria-label={s.label} key={s.label}>
                  <LinkIcon name={s.icon} size={18} />
                </a>
              ))}
            </div>
            <div className="footer__copy">{profile.copyright} | <a className="link-card__sub" href="/designsystem">Design System(Webpage)</a></div>
            <div className="footer__sub">{profile.footnote}</div>
          </div>
        </div>
}

export default Footer;