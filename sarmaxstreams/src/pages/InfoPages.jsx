import React from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import Navbar from "@/components/Navbar";

// ---- Edit these two lines if anything changes ----------------------------
const TELEGRAM_HANDLE = "saremmenur";
const UPDATED = "September 20, 2026";
// --------------------------------------------------------------------------

const TELEGRAM_URL = `https://t.me/${TELEGRAM_HANDLE}`;

function TelegramLogo({ className = "w-7 h-7" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="12" fill="#229ED9" />
      <path
        fill="#fff"
        d="M16.906 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"
      />
    </svg>
  );
}

function TelegramLink({ children }) {
  return (
    
      href={TELEGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline"
    >
      {children || `@${TELEGRAM_HANDLE} on Telegram`}
    </a>
  );
}

function Shell({ title, children }) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-nav pb-page mx-auto max-w-3xl px-4 sm:px-6">
        <h1 className="font-display font-bold tracking-tight text-3xl sm:text-4xl mb-2">{title}</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated {UPDATED}</p>
        <div className="space-y-8 text-[15px] leading-relaxed text-muted-foreground">{children}</div>
      </main>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="font-display font-semibold text-lg text-foreground mb-2">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ Terms */

export function Terms() {
  return (
    <Shell title="Terms of Service">
      <p>
        This Agreement contains the complete terms and conditions that apply to your participation
        in our site. If you wish to use the site, including its tools and services, please read
        these terms of use carefully.
      </p>

      <Section title="Modifications of Terms and Conditions">
        <p>
          Amendments to this agreement can be made and effected by us from time to time without
          specific notice to you. The agreement posted on the Site reflects the latest version, and
          you should review it carefully before you use our site.
        </p>
      </Section>

      <Section title="Use of the Site">
        <p>
          The Site allows you to browse movies and TV shows, search for titles, keep a My List and
          watch through a third-party player. You are prohibited from doing the following:
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Using our site, including its services and tools, if you are under the age of 18</li>
          <li>Collecting information about other users&apos; personal information</li>
          <li>Attacking, scraping or overloading the site, or getting around the limits we put in place</li>
          <li>Posting or sending false, inaccurate, misleading, defamatory, or libelous content</li>
          <li>Using the site for anything unlawful</li>
        </ul>
      </Section>

      <Section title="Registration Information">
        <p>
          To create an account you must provide a valid email address and a password, or sign in
          with Google. You must be 18 years or older, and you are responsible for keeping your
          password secure and for all activity under your account. You can browse and play without
          an account. You can delete your account at any time from the Account section on your My
          List page.
        </p>
      </Section>

      <Section title="Third-Party Content and Services">
        <p>
          sarmaxstream doesn&apos;t host, store or upload video files. Playback is provided by a
          third-party player embedded in our page, and movie and TV information comes from TMDB.
          Those services are run by someone else. The player can show ads or pop-ups, set its own
          cookies, and be unavailable at times. We don&apos;t control it and aren&apos;t responsible
          for it. Never enter passwords or payment details on a pop-up, and be careful what you
          click.
        </p>
      </Section>

      <Section title="Copyright">
        <p>
          We respect copyright. If you own rights to a work and believe something reachable through
          sarmaxstream infringes them, message us on <TelegramLink /> with: the title and the page
          address on our site, a description of your work, your contact details, and a statement
          that you&apos;re the rights holder or authorized to act for them. We&apos;ll review it
          promptly and remove or disable the relevant title or link where appropriate.
        </p>
      </Section>

      <Section title="No Warranty">
        <p>
          The site is provided &ldquo;as is&rdquo; and may change, be interrupted or stop working
          without notice. To the extent the law allows, we aren&apos;t liable for any loss arising
          from your use of the site or of third-party services embedded from it.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about these terms? Message us on <TelegramLink /> or see our{" "}
          <Link to="/contact" className="text-primary hover:underline">
            Contact
          </Link>{" "}
          page.
        </p>
      </Section>
    </Shell>
  );
}

/* ---------------------------------------------------------------- Privacy */

export function Privacy() {
  return (
    <Shell title="Privacy Policy">
      <p>
        We take your privacy seriously. This Privacy Policy explains how we collect, use, disclose,
        and safeguard your information when you use our service.
      </p>

      <Section title="Information We Collect">
        <p>We collect information that you provide directly to us when you:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Create an account (your email address, or your name and email if you use Google)</li>
          <li>Use our services, such as saving titles to My List and your continue-watching progress</li>
          <li>Contact us for support</li>
        </ul>
        <p>
          We also receive some information automatically. Our server briefly sees your IP address on
          each request so it can limit abuse. When something breaks, an error report (browser type,
          page, error message and rough location such as your country) is sent to our
          error-monitoring service, Sentry, without personal details.
        </p>
      </Section>

      <Section title="How We Use Your Information">
        <p>We use the information we collect to:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Provide, maintain, and improve our services</li>
          <li>Send you technical notices and support messages</li>
          <li>Protect against fraudulent or illegal activity</li>
        </ul>
        <p>
          We don&apos;t sell your personal data. If we ever add advertising, newsletters or
          anything else that changes how we use your information, we&apos;ll update this policy
          first.
        </p>
      </Section>

      <Section title="Third-Party Services">
        <p>
          We use Supabase (accounts and saved data), Vercel, Railway and Render (hosting), Sentry
          (error reports) and Google (only if you use Google sign-in). Posters and images load
          directly from TMDB&apos;s servers, so TMDB can see your IP address when they load. The
          third-party video player receives your IP address and device details when you press Play
          and may set cookies or show ads under its own policies, which we don&apos;t control.
        </p>
      </Section>

      <Section title="Data Security">
        <p>
          We implement appropriate technical and organizational measures to protect your personal
          data against unauthorized or unlawful processing, accidental loss, destruction, or damage.
        </p>
      </Section>

      <Section title="Your Rights">
        <p>You have the right to:</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Access your personal data</li>
          <li>Correct inaccurate data</li>
          <li>Request deletion of your data</li>
          <li>Object to processing of your data</li>
          <li>Request transfer of your data</li>
        </ul>
        <p>
          You can also delete your account and its data yourself from the Account section on your
          My List page.
        </p>
      </Section>

      <Section title="Children">
        <p>Our service is not intended for anyone under the age of 18.</p>
      </Section>

      <Section title="Contact Us">
        <p>
          If you have any questions about this Privacy Policy, please contact us on <TelegramLink />{" "}
          or through our{" "}
          <Link to="/contact" className="text-primary hover:underline">
            Contact
          </Link>{" "}
          page.
        </p>
      </Section>
    </Shell>
  );
}

/* -------------------------------------------------------------------- FAQ */

const FAQS = [
  {
    q: "What is sarmaxstream?",
    a: "A site for finding movies and TV shows. You can browse what's popular, search for a title, save it to My List and press Play.",
  },
  {
    q: "Do I need an account?",
    a: "No. You can browse and play without one. An account lets you keep a My List and continue watching where you stopped.",
  },
  {
    q: "Where do the videos come from?",
    a: "Playback is provided by a third-party player embedded in the page. sarmaxstream doesn't host or store any video files.",
  },
  {
    q: "A video won't play, or I see pop-ups.",
    a: "The player belongs to a third party, so it can be slow, unavailable, or show ads. Try refreshing, or open the title again later. Be careful with pop-ups and never enter passwords or payment details on them. If a title keeps failing, tell us on Telegram.",
  },
  {
    q: "How do I save a title?",
    a: "Sign in, open the title page and press the My List button. Your saved titles appear under My List.",
  },
  {
    q: "I forgot my password.",
    a: "On the sign-in page choose “Forgot password” and we'll email you a reset link.",
  },
  {
    q: "How do I delete my account?",
    a: "Open My List, go to the Account section and choose the delete option. This removes your account and your saved data.",
  },
  {
    q: "Why is some information missing or different?",
    a: "Titles, posters and descriptions come from TMDB. If something there is missing, it can be added or fixed on TMDB itself.",
  },
  {
    q: "How do I report a problem or a copyright issue?",
    a: "Message us on Telegram. For copyright notices, include the details listed in our Terms of Service.",
  },
];

export function Faq() {
  return (
    <Shell title="FAQs">
      <div className="space-y-3">
        {FAQS.map((f) => (
          <details key={f.q} className="group rounded-xl border border-border/60 bg-white/5 px-4 py-3">
            <summary className="flex items-center justify-between gap-3 cursor-pointer list-none font-medium text-foreground">
              {f.q}
              <ChevronDown className="w-4 h-4 shrink-0 transition-transform group-open:rotate-180" />
            </summary>
            <p className="mt-2">{f.a}</p>
          </details>
        ))}
      </div>
      <p>
        Still stuck? Message us on <TelegramLink />.
      </p>
    </Shell>
  );
}

/* ---------------------------------------------------------------- Contact */

export function Contact() {
  return (
    <Shell title="Contact">
      <p>
        Questions, problems with a title, or a copyright notice? The fastest way to reach us is
        Telegram.
      </p>

      
        href={TELEGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-3 h-14 px-6 rounded-full bg-white/5 border border-border/60 hover:bg-white/10 transition"
      >
        <TelegramLogo />
        <span className="text-foreground font-semibold">@{TELEGRAM_HANDLE}</span>
      </a>

      <Section title="When you write to us">
        <p>
          Tell us the title or page address, what happened, and which device and browser you use.
          That helps us fix things faster. We&apos;ll reply as soon as we can.
        </p>
        <p>
          For copyright notices, please include the details listed in our{" "}
          <Link to="/terms" className="text-primary hover:underline">
            Terms of Service
          </Link>
          .
        </p>
      </Section>
    </Shell>
  );
}