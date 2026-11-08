import { describe, expect, it } from "vitest";

import { fileSize, notificationHref, notificationValues, statusTone, ticketFilter } from "./portal";

const org = { id: "org-1", name: "Acme", slug: "acme" };

describe("portal helpers", () => {
  it("only accepts the known ticket filters", () => {
    expect(ticketFilter("closed")).toBe("closed");
    expect(ticketFilter(["all"])).toBe("open");
    expect(ticketFilter("drop table")).toBe("open");
    expect(ticketFilter(undefined)).toBe("open");
  });

  it("formats sizes in the reader's language", () => {
    const units = { kb: "Ko", mb: "Mo" };
    expect(fileSize(10, units, "fr")).toBe("1 Ko");
    expect(fileSize(2_500, units, "fr")).toBe("2 Ko");
    expect(fileSize(2.5 * 1024 * 1024, units, "fr")).toBe("2,5 Mo");
    expect(fileSize(2.5 * 1024 * 1024, { kb: "KB", mb: "MB" }, "en")).toBe("2.5 MB");
  });

  it("leads clients to the portal and staff to the back office", () => {
    const ticket = { organization: org, data: { ticket_id: "t-1", project_id: "p-1" } };
    expect(notificationHref({ ...ticket, for_staff: false })).toEqual({
      pathname: "/account/portal/[org]/support/[ticket]",
      params: { org: "org-1", ticket: "t-1" },
    });
    expect(notificationHref({ ...ticket, for_staff: true })).toEqual({
      pathname: "/admin/portal/support/[id]",
      params: { id: "t-1" },
    });
    const project = { organization: org, data: { project_id: "p-1" } };
    expect(notificationHref({ ...project, for_staff: true })).toEqual({ pathname: "/admin/portal/projects/[id]", params: { id: "p-1" } });
    expect(notificationHref({ organization: org, data: { file_id: "f" }, for_staff: false })).toEqual({
      pathname: "/account/portal/[org]/documents",
      params: { org: "org-1" },
    });
    expect(notificationHref({ organization: org, data: { file_id: "f" }, for_staff: true })).toBe("/admin/portal");
  });

  it("gives the notification texts their values, nothing else", () => {
    expect(notificationValues({ organization: org, data: { project: "RH", version: 2, nested: { x: 1 } } })).toEqual({
      organization: "Acme",
      project: "RH",
      version: "2",
    });
  });

  it("makes what needs attention stand out", () => {
    expect(statusTone("pending_review")).toBe("accent");
    expect(statusTone("approved")).toBe("success");
    expect(statusTone("closed")).toBe("muted");
    expect(statusTone("in_progress")).toBe("neutral");
  });
});
