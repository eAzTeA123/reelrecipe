"use client";

import { useEffect, useMemo, useState } from "react";
import { getCollectionRepository } from "@/data";
import { useRecipes } from "@/hooks/useRecipes";
import { PageHeader } from "@/components/PageHeader";
import { RecipeCard } from "@/components/RecipeCard";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { Input, Field } from "@/components/Input";
import { IconPlus, IconTrash, IconArrowUp, IconArrowDown } from "@/components/Icons";
import { useI18n } from "@/lib/i18n/context";
import { useToast } from "@/components/Toast";
import { resolveCollectionRecipes } from "@/lib/collections";
import type { Collection } from "@/domain/types";

/**
 * Sammlungen (Ordner): anlegen, umbenennen, sortieren, löschen und den Inhalt
 * direkt darunter sehen. Eine Sammlung füllt sich über einen Filter selbst
 * oder über manuell hinzugefügte Rezepte – beides ist kombinierbar.
 */
export default function CollectionsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const { recipes, loading } = useRecipes();
  const repo = useMemo(() => getCollectionRepository(), []);

  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [newName, setNewName] = useState("");
  const [renameId, setRenameId] = useState<string | undefined>();
  const [renameValue, setRenameValue] = useState("");
  const [deleteId, setDeleteId] = useState<string | undefined>();

  useEffect(() => {
    void repo.list()
      .then((entries) => {
        setCollections(entries);
        setSelectedId((current) => current ?? entries[0]?.id);
      })
      .catch((e) => console.error("collections load failed", e));
  }, [repo]);

  const selected = collections.find((entry) => entry.id === selectedId);
  const contents = useMemo(
    () => (selected ? resolveCollectionRecipes(selected, recipes) : []),
    [selected, recipes],
  );

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      const created = await repo.create({ name: newName });
      setCollections(await repo.list());
      setSelectedId(created.id);
      setNewName("");
    } catch (e) {
      console.error("collection create failed", e);
      toast(e instanceof Error ? e.message : t("collections.createFailed"), "error");
    }
  }

  async function handleRename(id: string) {
    if (!renameValue.trim()) return;
    await repo.rename(id, renameValue);
    setCollections(await repo.list());
    setRenameId(undefined);
    setRenameValue("");
  }

  async function handleDelete(id: string) {
    await repo.delete(id);
    const next = await repo.list();
    setCollections(next);
    setSelectedId(next[0]?.id);
    setDeleteId(undefined);
    toast(t("collections.deleted"));
  }

  async function move(id: string, direction: -1 | 1) {
    const order = collections.map((entry) => entry.id);
    const index = order.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    await repo.setOrder(order);
    setCollections(await repo.list());
  }

  return (
    <>
      <PageHeader title={t("collections.title")} subtitle={t("collections.subtitle")} />

      <section className="mb-6 rounded-2xl bg-surface p-5 shadow-card">
        <Field label={t("collections.newLabel")} htmlFor="collection-name">
          <div className="flex gap-2">
            <Input
              id="collection-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("collections.newPlaceholder")}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreate();
              }}
            />
            <Button onClick={() => void handleCreate()} disabled={!newName.trim()} aria-label={t("collections.create")}>
              <IconPlus size={18} />
            </Button>
          </div>
        </Field>
      </section>

      {collections.length === 0 ? (
        <EmptyState
          title={t("collections.emptyTitle")}
          subtitle={t("collections.emptySubtitle")}
        />
      ) : (
        <>
          <ul className="mb-6 flex flex-col gap-2">
            {collections.map((collection, index) => {
              const active = collection.id === selectedId;
              const count = resolveCollectionRecipes(collection, recipes).length;
              return (
                <li
                  key={collection.id}
                  className={`rounded-2xl border p-3 ${active ? "border-accent bg-surface" : "border-line bg-surface"}`}
                >
                  {renameId === collection.id ? (
                    <div className="flex gap-2">
                      <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleRename(collection.id);
                        }}
                        aria-label={t("collections.rename")}
                      />
                      <Button variant="secondary" onClick={() => void handleRename(collection.id)}>
                        {t("general.save")}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedId(collection.id)}
                        className="pressable min-h-11 min-w-0 flex-1 text-left"
                        aria-pressed={active}
                      >
                        <span className="font-semibold text-ink">{collection.name}</span>
                        <span className="ml-2 text-[13px] text-ink-3">
                          {count} {count === 1 ? t("collections.item") : t("collections.items")}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void move(collection.id, -1)}
                        disabled={index === 0}
                        className="pressable rounded-full p-2 text-ink-2 disabled:opacity-30"
                        aria-label={t("collections.moveUp")}
                      >
                        <IconArrowUp size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void move(collection.id, 1)}
                        disabled={index === collections.length - 1}
                        className="pressable rounded-full p-2 text-ink-2 disabled:opacity-30"
                        aria-label={t("collections.moveDown")}
                      >
                        <IconArrowDown size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRenameId(collection.id);
                          setRenameValue(collection.name);
                        }}
                        className="pressable rounded-full px-2 py-1 text-[13px] font-medium text-ink-2"
                      >
                        {t("collections.rename")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteId(collection.id)}
                        className="pressable rounded-full p-2 text-danger"
                        aria-label={t("collections.delete")}
                      >
                        <IconTrash size={18} />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          <h2 className="mb-3 text-[17px] font-bold">{t("collections.contents")}</h2>
          {loading ? null : contents.length === 0 ? (
            <EmptyState
              title={t("collections.emptyContentsTitle")}
              subtitle={t("collections.emptyContentsSubtitle")}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {contents.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={deleteId !== undefined}
        title={t("collections.deleteConfirmTitle")}
        message={t("collections.deleteConfirmMessage")}
        confirmLabel={t("collections.delete")}
        onConfirm={() => {
          if (deleteId) void handleDelete(deleteId);
        }}
        onCancel={() => setDeleteId(undefined)}
      />
    </>
  );
}

