"use client";

import React, { useMemo, useState } from "react";
import { useAgency } from "@/context/AgencyContext";
import { TeamMember, UserRole } from "@/types/agency";
import {
  Check,
  Copy,
  Edit3,
  Lock,
  Mail,
  Phone,
  Plus,
  Send,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";

export function TeamView() {
  const {
    db,
    currentUser,
    permissions,
    addTeamMember,
    updateTeamMember,
    deleteTeamMember,
    inviteTeamMember,
    updateTask,
    updateProject,
  } = useAgency();

  const [isOpen, setIsOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [assignProjectId, setAssignProjectId] = useState("");
  const [assignTaskId, setAssignTaskId] = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Invitation form state (Part 2)
  const [inviteForm, setInviteForm] = useState({
    name: "",
    email: "",
    role: "Team Member" as UserRole,
    title: "Product Designer",
    department: "Delivery",
  });
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);

  const emptyForm = {
    name: "",
    email: "",
    role: "Team Member" as UserRole,
    title: "",
    phone: "",
    department: "Delivery",
    hourlyRate: 100,
    status: "Active" as TeamMember["status"],
  };
  const [form, setForm] = useState(emptyForm);
  const isAdmin = currentUser.role === "Admin";

  const workload = useMemo(() => {
    return db.teamMembers.map((m) => {
      const tasks = db.tasks.filter((t) => t.assignedPersonId === m.id);
      const open = tasks.filter((t) => t.status !== "Completed");
      const completed = tasks.filter((t) => t.status === "Completed");
      const projects = db.projects.filter((p) =>
        p.assignedTeamMembers.includes(m.id)
      );
      const clients = db.clients.filter(
        (c) => c.assignedAccountManagerId === m.id
      );
      const overdue = open.filter(
        (t) => t.dueDate < new Date().toISOString().slice(0, 10)
      );
      return { member: m, tasks, open, completed, projects, clients, overdue };
    });
  }, [db.teamMembers, db.tasks, db.projects, db.clients]);

  const selected = workload.find((w) => w.member.id === selectedId) || null;

  if (!permissions.team) {
    return (
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-10 text-center max-w-lg mx-auto my-12 space-y-3">
        <Lock className="w-5 h-5 mx-auto text-neutral-500" />
        <h2 className="text-base font-semibold">Team Management Restricted</h2>
        <p className="text-xs text-neutral-500">
          Only Admins and Managers can manage team members and workloads. You can still see your assigned tasks in Tasks.
        </p>
      </div>
    );
  }

  const openEdit = (m: TeamMember) => {
    setEditing(m);
    setForm({
      name: m.name,
      email: m.email,
      role: m.role,
      title: m.title,
      phone: m.phone,
      department: m.department,
      hourlyRate: m.hourlyRate,
      status: m.status,
    });
    setError("");
    setIsOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !/^\S+@\S+\.\S+$/.test(form.email)) {
      setError("A valid name and email are required.");
      return;
    }
    const dup = db.teamMembers.find(
      (m) =>
        m.email.toLowerCase() === form.email.toLowerCase() &&
        m.id !== editing?.id
    );
    if (dup) {
      setError("A team member with this email already exists.");
      return;
    }
    if (!isAdmin && form.role === "Admin") {
      setError("Only Admins can grant the Admin role.");
      return;
    }
    const initials = form.name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    if (editing)
      updateTeamMember(editing.id, { ...form, avatarInitials: initials });
    else addTeamMember({ ...form, avatarInitials: initials });
    setIsOpen(false);
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const res = await inviteTeamMember(inviteForm);
    if (!res.ok) {
      setError(res.error || "Failed to send invitation");
      return;
    }
    setIsInviteOpen(false);
    setInviteForm({
      name: "",
      email: "",
      role: "Team Member",
      title: "Product Designer",
      department: "Delivery",
    });
    if (res.invitation) {
      setInviteFeedback(
        `Invitation issued for ${res.invitation.name} (${res.invitation.email}). Token: ${res.invitation.token}`
      );
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Team, Invitations &amp; Workload
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            {db.teamMembers.length} active members · Invite team members by email with server-enforced Role-Based Access Control.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setError("");
              setIsInviteOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
          >
            <UserPlus className="w-3.5 h-3.5" /> Invite Team Member by Email
          </button>
        </div>
      </div>

      {inviteFeedback && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between">
          <span>{inviteFeedback}</span>
          <button
            type="button"
            onClick={() => setInviteFeedback(null)}
            className="ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Pending Email Invitations Table */}
      {(db.invitations || []).length > 0 && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-4 space-y-2.5 text-xs">
          <h2 className="text-sm font-semibold">
            Workspace Email Invitations ({(db.invitations || []).length})
          </h2>
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {(db.invitations || []).map((inv) => (
              <div
                key={inv.id}
                className="py-2.5 flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <span className="font-semibold">{inv.name}</span>{" "}
                  <span className="text-neutral-500">({inv.email})</span> ·{" "}
                  <span className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 font-medium">
                    {inv.role}
                  </span>{" "}
                  · <span className="text-neutral-400">{inv.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-[11px] px-2 py-0.5 rounded bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800">
                    {inv.token}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(inv.token);
                      setCopiedToken(inv.token);
                      setTimeout(() => setCopiedToken(null), 2000);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50"
                  >
                    {copiedToken === inv.token ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copy Token
                      </>
                    )}
                  </button>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      inv.status === "Accepted"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {inv.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {workload.map(
          ({ member, open, completed, projects, clients, overdue }) => {
            const load = Math.min(100, open.length * 20);
            return (
              <div
                key={member.id}
                className={`bg-white dark:bg-neutral-900 border rounded-xl p-5 transition cursor-pointer ${
                  selectedId === member.id
                    ? "border-neutral-900 dark:border-white"
                    : "border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-400"
                }`}
                onClick={() => setSelectedId(member.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 flex items-center justify-center text-xs font-semibold">
                      {member.avatarInitials}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{member.name}</div>
                      <div className="text-[11px] text-neutral-500">
                        {member.title}
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-neutral-200 dark:border-neutral-700">
                    {member.role}
                  </span>
                </div>
                <div className="mt-3 text-[11px] text-neutral-500 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3 h-3" /> {member.email}
                  </div>
                  {member.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3 h-3" /> {member.phone}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2 mt-4 text-center">
                  {[
                    { l: "Open", v: open.length },
                    { l: "Done", v: completed.length },
                    { l: "Projects", v: projects.length },
                    { l: "Clients", v: clients.length },
                  ].map((s) => (
                    <div
                      key={s.l}
                      className="rounded-lg bg-neutral-50 dark:bg-neutral-950 py-1.5"
                    >
                      <div className="text-sm font-semibold">{s.v}</div>
                      <div className="text-[10px] text-neutral-400">{s.l}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <div className="flex justify-between text-[10px] text-neutral-400 mb-1">
                    <span>Workload</span>
                    <span>
                      {overdue.length > 0
                        ? `${overdue.length} overdue`
                        : `${load}%`}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        load >= 80 || overdue.length
                          ? "bg-amber-500"
                          : "bg-neutral-900 dark:bg-white"
                      }`}
                      style={{ width: `${load}%` }}
                    />
                  </div>
                </div>
                <div
                  className="flex justify-end gap-1 mt-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => openEdit(member)}
                    className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  {isAdmin && member.id !== currentUser.id && (
                    <button
                      type="button"
                      onClick={() => setDeleteId(member.id)}
                      className="p-1.5 rounded hover:bg-red-50 text-neutral-400 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          }
        )}
      </div>

      {selected && (
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 rounded-xl p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              {selected.member.name} — Assignments
            </h2>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="flex gap-2">
              <select
                value={assignProjectId}
                onChange={(e) => setAssignProjectId(e.target.value)}
                className="flex-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
              >
                <option value="">Assign to project…</option>
                {db.projects
                  .filter(
                    (p) => !p.assignedTeamMembers.includes(selected.member.id)
                  )
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.projectName}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                disabled={!assignProjectId}
                onClick={() => {
                  const p = db.projects.find((x) => x.id === assignProjectId);
                  if (p)
                    updateProject(p.id, {
                      assignedTeamMembers: [
                        ...p.assignedTeamMembers,
                        selected.member.id,
                      ],
                    });
                  setAssignProjectId("");
                }}
                className="px-3 py-1.5 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium disabled:opacity-40"
              >
                Assign
              </button>
            </div>
            <div className="flex gap-2">
              <select
                value={assignTaskId}
                onChange={(e) => setAssignTaskId(e.target.value)}
                className="flex-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
              >
                <option value="">Reassign a task…</option>
                {db.tasks
                  .filter(
                    (t) =>
                      t.assignedPersonId !== selected.member.id &&
                      t.status !== "Completed"
                  )
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.taskTitle}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                disabled={!assignTaskId}
                onClick={() => {
                  updateTask(assignTaskId, {
                    assignedPersonId: selected.member.id,
                  });
                  setAssignTaskId("");
                }}
                className="px-3 py-1.5 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium disabled:opacity-40"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INVITE TEAM MEMBER BY EMAIL MODAL (Part 2) */}
      {isInviteOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800 mb-4">
              <div>
                <h2 className="text-base font-semibold">
                  Invite Team Member by Email
                </h2>
                <p className="text-xs text-neutral-500">
                  Generates a secure invitation token for registration in Twofold Studio OS.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsInviteOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-medium mb-1">Full Name *</label>
                <input
                  required
                  value={inviteForm.name}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, name: e.target.value })
                  }
                  placeholder="Devon Brooks"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>
              <div>
                <label className="block font-medium mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={inviteForm.email}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, email: e.target.value })
                  }
                  placeholder="devon@twofold.studio"
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Role</label>
                  <select
                    value={inviteForm.role}
                    onChange={(e) =>
                      setInviteForm({
                        ...inviteForm,
                        role: e.target.value as UserRole,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    {isAdmin && <option value="Admin">Admin</option>}
                    <option value="Manager">Manager</option>
                    <option value="Team Member">Team Member</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Department</label>
                  <input
                    value={inviteForm.department}
                    onChange={(e) =>
                      setInviteForm({
                        ...inviteForm,
                        department: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
              </div>
              <div>
                <label className="block font-medium mb-1">Job Title</label>
                <input
                  value={inviteForm.title}
                  onChange={(e) =>
                    setInviteForm({ ...inviteForm, title: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                />
              </div>

              {error && <div className="text-red-600">{error}</div>}

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsInviteOpen(false)}
                  className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium inline-flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> Issue Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl max-w-lg w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800 mb-4">
              <h2 className="text-base font-semibold">
                {editing ? "Edit Team Member" : "Add Team Member"}
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { k: "name", l: "Full Name *" },
                  { k: "email", l: "Email *" },
                  { k: "title", l: "Job Title" },
                  { k: "phone", l: "Phone" },
                  { k: "department", l: "Department" },
                ].map((f) => (
                  <div key={f.k}>
                    <label className="block font-medium mb-1">{f.l}</label>
                    <input
                      value={(form as unknown as Record<string, string>)[f.k]}
                      onChange={(e) =>
                        setForm({ ...form, [f.k]: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                    />
                  </div>
                ))}
                <div>
                  <label className="block font-medium mb-1">Hourly Rate</label>
                  <input
                    type="number"
                    value={form.hourlyRate}
                    onChange={(e) =>
                      setForm({ ...form, hourlyRate: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Role</label>
                  <select
                    value={form.role}
                    onChange={(e) =>
                      setForm({ ...form, role: e.target.value as UserRole })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    {isAdmin && <option value="Admin">Admin</option>}
                    <option value="Manager">Manager</option>
                    <option value="Team Member">Team Member</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        status: e.target.value as TeamMember["status"],
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950"
                  >
                    <option value="Active">Active</option>
                    <option value="Away">Away</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
              {error && <div className="text-red-600">{error}</div>}
              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-medium"
                >
                  {editing ? "Save Changes" : "Add Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl max-w-sm w-full p-5 text-xs">
            <h3 className="text-sm font-semibold">Remove team member?</h3>
            <p className="text-neutral-500 mt-1">
              Their tasks and projects will remain but become unassigned to them.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteTeamMember(deleteId);
                  setDeleteId(null);
                  setSelectedId(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-medium"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
