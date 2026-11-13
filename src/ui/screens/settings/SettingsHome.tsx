"use client";

import { Accessibility, Activity, BellRing, Clock, Eye, Link2, Lock, Smartphone, Users, Volume2 } from "lucide-react";
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
            <ListLink href="/settings/voice" icon={Volume2} title="Voice and language" description="Speed, voice, language, how much I explain" />
          </li>
          <li>
            <ListLink href="/settings/accessibility" icon={Accessibility} title="Accessibility" description="Motion, screen reader, vibration" />
          </li>
          <li>
            <ListLink href="/history" icon={Clock} title="Past conversations" description="See or remove what we talked about" />
          </li>
          <li>
            <ListLink href="/settings/people" icon={Users} title="People" description="Who I can call or text for you" />
          </li>
          <li>
            <ListLink href="/settings/reminders" icon={BellRing} title="Reminders" description="See or remove your reminders" />
          </li>
          <li>
            <ListLink href="/settings/phone" icon={Smartphone} title="Device permissions" description="Camera, microphone, contacts, notifications" />
          </li>
          <li>
            <ListLink href="/settings/connections" icon={Link2} title="Connected accounts" description="Calendar, Gmail and more" />
          </li>
          <li>
            <ListLink href="/status" icon={Activity} title="Status" description="Is everything working right now?" />
          </li>
          <li>
            <ListLink href="/settings/privacy" icon={Lock} title="Privacy and safety" description="Saved conversations, asking first" />
          </li>
        </ListGroup>
      </nav>
    </ScrollPage>
  );
}
