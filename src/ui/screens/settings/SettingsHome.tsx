"use client";

import { Accessibility, Award, BellRing, Eye, Link2, Lock, Smartphone, Users, Volume2 } from "lucide-react";
import { BRAND } from "../../components/BrandMark";
import { ListGroup, ListLink } from "../../components/ListLink";
import { PageHeader } from "../../components/PageHeader";
import { ScrollPage } from "../../components/ScrollPage";

export function SettingsHome() {
  return (
    <ScrollPage>
      <PageHeader title="Settings" />
      <nav aria-label="Settings sections">
        <ListGroup>
          <li>
            <ListLink href="/settings/display" icon={Eye} title="Text and looks" description="Text size, colours, buttons" />
          </li>
          <li>
            <ListLink href="/settings/voice" icon={Volume2} title="Voice" description="Speed, volume and which voice" />
          </li>
          <li>
            <ListLink href="/settings/accessibility" icon={Accessibility} title="Accessibility" description="Motion, screen reader, vibration" />
          </li>
          <li>
            <ListLink href="/settings/learned" icon={Award} title="Things you can do" description="What you've learned with my help" />
          </li>
          <li>
            <ListLink href="/settings/people" icon={Users} title="People" description="Who I can call or text for you" />
          </li>
          <li>
            <ListLink href="/settings/reminders" icon={BellRing} title="Reminders" description="See or remove your reminders" />
          </li>
          <li>
            <ListLink href="/settings/phone" icon={Smartphone} title="Phone and permissions" description="Microphone, notifications, what works here" />
          </li>
          <li>
            <ListLink href="/settings/connections" icon={Link2} title="Connected accounts" description="Calendar, Gmail and more" />
          </li>
          <li>
            <ListLink href="/settings/privacy" icon={Lock} title="Privacy and safety" description="Saved conversations, asking first" />
          </li>
        </ListGroup>
      </nav>
      <p className="text-base text-muted">
        {BRAND.name}, built at {BRAND.event} 2026.
      </p>
    </ScrollPage>
  );
}
