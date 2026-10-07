"use client";

import { useEffect, useMemo, useState } from "react";
import { getCollectionRepository } from "@/data";
import { useRecipes } from "@/hooks/useRecipes";
import { PageHeader } from "@/components/PageHeader";
import { RecipeCard } from "@/components/RecipeCard";
import { useProgressiveList } from "@/hooks/useProgressiveList";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { Input, Field } from "@/components/Input";
import { CollectionFilterSheet } from "@/components/CollectionFilterSheet";
import { RecipePickerSheet } from "@/components/RecipePickerSheet";
import {
  IconPlus,
  IconTrash,
  IconArrowUp,
  IconArrowDown,
  IconPencil,
  IconChevronDown,
  IconFilter,
  IconX,
} from "@/components/Icons";
import { useI18n } from "@/lib/i18n/context";
import { useToast } from "@/components/Toast";
import { CATEGORIES } from "@/domain/categories";
import { collectTags } from "@/lib/tags";
import {
  isCollectionFilterEmpty,
  matchesCollectionFilter,
  resolveCollectionRecipes,
} from "@/lib/collections";
import type { Collection, CollectionFilter } from "@/domain/types";

/**
 * Sammlungen (Ordner): anlegen, umbenennen, sortieren, löschen und den Inhalt
 * direkt darunter sehen.
 *
 * Eine Sammlung beschreibt mit **eigenen Filtern** (Kategorie, Gesamtzeit,
 * Favoriten, Titel, Zutat), welche Rezepte hineingehören – die Rezepte selbst
 * müssen dafür nicht verschlagwortet werden. Zusätzlich lassen sich einzelne
 * Rezepte von Hand aufnehmen; beides zusammen ist die Vereinigung.
 *
 * Mobile-first: die Zeile zeigt nur Name und Anzahl, die Werkzeuge erscheinen
 * erst für die geöffnete Sammlung.
 */
export default function CollectionsPage() {
  const { t } = useI18n();
  const toast = useToast();
  const { recipes, loading } = useRecipes();
  const repo = useMemo(() => getCollectionRepository(), []);

  const [collections, setCollections] = useState<Collection[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameId, setRenameId] = useState<string | undefined>();
  const [renameValue, setRenameValue] = useState("");
  const [deleteId, setDeleteId] = useState<string | undefined>();
  const [filterOpen, setFilterOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    void repo.list()
      .then((entries) => {
        setCollections(entries);
        setSelectedId((current) => current ?? entries[0]?.id);
        setLoaded(true);
      })
      .catch((e) => {
        console.error("collections load failed", e);
        setLoaded(true);
      });
  }, [repo]);

  const selected = collections.find((entry) => entry.id === selectedId);
  const contents = useMemo(
    () => (selected ? resolveCollectionRecipes(selected, recipes) : []),
    [selected, recipes],
  );

  /*
   * Anzahl je Sammlung einmal berechnen statt in der Darstellung: Vorher lief
   * `resolveCollectionRecipes` für **jede** Sammlung bei **jedem** Rendern – bei
   * vielen Sammlungen und einer großen Bibliothek kostet das spürbar.
   */
  const countsByCollection = useMemo(() => {
    const counts = new Map<string, number>();
    for (const collection of collections) {
      counts.set(collection.id, resolveCollectionRecipes(collection, recipes).length);
    }
    return counts;
  }, [collections, recipes]);

  /** Portionsweises Rendern: Sammlungen können sehr viele Rezepte enthalten. */
  const { shown: shownContents, hasMore, sentinelRef, total } = useProgressiveList(contents, {
    resetKey: selectedId ?? "",
  });
  /** Rezepte, die der Filter der ausgewählten Sammlung schon erfasst. */
  const filterMatches = useMemo(() => {
    if (!selected) return [];
    return recipes.filter((recipe) => matchesCollectionFilter(selected.filter, recipe));
  }, [selected, recipes]);
  /** Bestands-Tags: nur zeigen, wenn es welche gibt (kein Zwang zum Taggen). */
  const tagOptions = useMemo(() => collectTags(recipes), [recipes]);

  /** Kategorien: die festen App-Kategorien plus alles, was in der Bibliothek steht. */
  const categoryOptions = useMemo(() => {
    const set = new Set<string>(CATEGORIES);
    for (const recipe of recipes) {
      const category = recipe.category?.trim();
      if (category) set.add(category);
    }
    return [...set];
  }, [recipes]);

  /** Ohne Sammlung ist das Anlegefeld direkt offen – es gibt sonst nichts zu tun. */
  const showCreateForm = creating || (loaded && collections.length === 0);

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      const created = await repo.create({ name: newName });
      setCollections(await repo.list());
      setSelectedId(created.id);
      setNewName("");
      setCreating(false);
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

  /** Filter sofort anwenden: erst lokal (flüssige Bedienung), dann speichern. */
  function handleFilterChange(next: CollectionFilter) {
    if (!selected) return;
    const id = selected.id;
    setCollections((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, filter: next } : entry)),
    );
    void repo.update(id, { filter: next }).catch((e) => {
      console.error("collection filter update failed", e);
    });
  }

  function handleToggleRecipe(recipeId: string, next: boolean) {
    if (!selected) return;
    const id = selected.id;
    const current = selected.recipeIds ?? [];
    const updated = next ? [...current, recipeId] : current.filter((entry) => entry !== recipeId);
    setCollections((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, recipeIds: updated } : entry)),
    );
    const call = next ? repo.addRecipes(id, [recipeId]) : repo.removeRecipe(id, recipeId);
    void call.catch((e) => console.error("collection membership update failed", e));
  }

  /** Beschriftung der gesetzten Filterregeln – ohne die Rezepte zu taggen. */
  function filterSummary(collection: Collection): string[] {
    const filter = collection.filter;
    if (!filter) return [];
    const labels: string[] = [];
    for (const category of filter.categories ?? []) {
      labels.push(t("collections.summaryCategory").replace("{value}", category));
    }
    if (filter.category) {
      labels.push(t("collections.summaryCategory").replace("{value}", filter.category));
    }
    if (filter.maxTotalTime !== undefined) {
      labels.push(t("collections.summaryTime").replace("{value}", String(filter.maxTotalTime)));
    }
    if (filter.favoritesOnly) labels.push(t("collections.summaryFavorite"));
    if (filter.titleContains?.trim()) {
      labels.push(t("collections.summaryTitle").replace("{value}", filter.titleContains.trim()));
    }
    if (filter.ingredientContains?.trim()) {
      labels.push(
        t("collections.summaryIngredient").replace("{value}", filter.ingredientContains.trim()),
      );
    }
    for (const tag of filter.tags ?? []) {
      labels.push(t("collections.summaryTag").replace("{value}", tag));
    }
    if (filter.query?.trim()) {
      labels.push(t("collections.summaryTitle").replace("{value}", filter.query.trim()));
    }
    return labels;
  }

  const manualIds = selected?.recipeIds ?? [];
  const hasFilter = selected ? !isCollectionFilterEmpty(selected.filter) : false;

  return (
    <>
      <PageHeader title={t("collections.title")} subtitle={t("collections.subtitle")} />

      {showCreateForm ? (
        <section className="mb-4 rounded-card bg-surface p-4 shadow-card">
          <Field label={t("collections.newLabel")} htmlFor="collection-name">
            <div className="flex gap-2">
              <Input
                id="collection-name"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("collections.newPlaceholder")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreate();
                }}
              />
              <Button
                onClick={() => void handleCreate()}
                disabled={!newName.trim()}
                aria-label={t("collections.create")}
              >
                <IconPlus size={18} />
              </Button>
            </div>
          </Field>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="pressable mb-4 flex min-h-12 w-full items-center gap-2 rounded-card border border-dashed border-line px-4 text-body font-semibold text-ink-2"
        >
          <IconPlus size={18} />
          {t("collections.newLabel")}
        </button>
      )}

      {collections.length === 0 ? (
        loaded ? (
          <EmptyState
            title={t("collections.emptyTitle")}
            subtitle={t("collections.emptySubtitle")}
          />
        ) : null
      ) : (
        <>
          <ul className="mb-6 flex flex-col gap-2">
            {collections.map((collection, index) => {
              const active = collection.id === selectedId;
              const count = countsByCollection.get(collection.id) ?? 0;
              const labels = filterSummary(collection);
              return (
                <li
                  key={collection.id}
                  className={`overflow-hidden rounded-card border bg-surface ${
                    active ? "border-accent" : "border-line"
                  }`}
                >
                  {renameId === collection.id ? (
                    <div className="flex flex-col gap-2 p-3">
                      <Input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void handleRename(collection.id);
                          if (e.key === "Escape") setRenameId(undefined);
                        }}
                        aria-label={t("collections.rename")}
                      />
                      <div className="flex gap-2">
                        <Button onClick={() => void handleRename(collection.id)}>
                          {t("general.save")}
                        </Button>
                        <Button variant="secondary" onClick={() => setRenameId(undefined)}>
                          {t("general.cancel")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setSelectedId(collection.id)}
                        aria-expanded={active}
                        className="pressable flex w-full items-center gap-3 px-3.5 py-2.5 text-left"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[16px] font-semibold text-ink">
                            {collection.name}
                          </span>
                          <span className="block text-meta text-ink-3">
                            {count} {count === 1 ? t("collections.item") : t("collections.items")}
                          </span>
                        </span>
                        <IconChevronDown
                          size={18}
                          className={`shrink-0 transition-transform ${
                            active ? "rotate-180 text-accent-text" : "text-ink-3"
                          }`}
                        />
                      </button>

                      {active && (
                        <div className="flex flex-col border-t border-line px-1.5 py-1.5">
                          {labels.length > 0 && (
                            <ul className="flex flex-wrap gap-1.5 px-1.5 pt-1">
                              {labels.map((label) => (
                                <li
                                  key={label}
                                  className="rounded-full bg-surface-2 px-2.5 py-1 text-label font-medium text-ink-2"
                                >
                                  {label}
                                </li>
                              ))}
                            </ul>
                          )}

                          <div className="flex flex-wrap items-center gap-1">
                            <button
                              type="button"
                              onClick={() => void move(collection.id, -1)}
                              disabled={index === 0}
                              className="pressable inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink-2 disabled:opacity-30"
                              aria-label={t("collections.moveUp")}
                            >
                              <IconArrowUp size={18} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void move(collection.id, 1)}
                              disabled={index === collections.length - 1}
                              className="pressable inline-flex h-10 w-10 items-center justify-center rounded-lg text-ink-2 disabled:opacity-30"
                              aria-label={t("collections.moveDown")}
                            >
                              <IconArrowDown size={18} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setFilterOpen(true)}
                              className={`pressable ml-auto inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-meta font-semibold ${
                                labels.length > 0 ? "text-accent-text" : "text-ink-2"
                              }`}
                            >
                              <IconFilter size={16} />
                              {t("collections.filterEdit")}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRenameId(collection.id);
                                setRenameValue(collection.name);
                              }}
                              className="pressable inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-meta font-semibold text-ink-2"
                              aria-label={t("collections.rename")}
                            >
                              <IconPencil size={16} />
                              <span className="sr-only sm:not-sr-only">
                                {t("collections.rename")}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteId(collection.id)}
                              className="pressable inline-flex h-10 w-10 items-center justify-center rounded-lg text-danger"
                              aria-label={t("collections.delete")}
                            >
                              <IconTrash size={18} />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-h3 font-bold">{t("collections.contents")}</h2>
            <Button
              size="sm"
              variant="secondary"
              className="ml-auto"
              onClick={() => setPickerOpen(true)}
            >
              <IconPlus size={16} />
              {t("collections.addRecipes")}
            </Button>
          </div>

          {loading ? null : contents.length === 0 ? (
            <EmptyState
              title={t("collections.emptyContentsTitle")}
              subtitle={
                hasFilter ? t("collections.emptyContentsSubtitle") : t("collections.filterNone")
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {shownContents.map((recipe) => {
                const removable = manualIds.includes(recipe.id);
                return (
                  <div key={recipe.id} className="relative">
                    <RecipeCard recipe={recipe} />
                    {removable && (
                      <button
                        type="button"
                        onClick={() => handleToggleRecipe(recipe.id, false)}
                        aria-label={t("collections.removeFromCollection").replace(
                          "{title}",
                          recipe.title,
                        )}
                        className="pressable absolute left-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-surface/90 text-ink-2 backdrop-blur"
                      >
                        <IconX size={18} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {!loading && contents.length > 0 && hasMore && (
            <div ref={sentinelRef} className="mt-6 flex justify-center">
              <p role="status" className="nums text-meta text-ink-3">
                {shownContents.length} von {total} Rezepten angezeigt – weiter scrollen lädt mehr
              </p>
            </div>
          )}
        </>
      )}

      {selected && filterOpen && (
        <CollectionFilterSheet
          open
          onClose={() => setFilterOpen(false)}
          collectionName={selected.name}
          filter={selected.filter}
          matchCount={filterMatches.length}
          categoryOptions={categoryOptions}
          tagOptions={tagOptions}
          onChange={handleFilterChange}
        />
      )}

      {selected && pickerOpen && (
        <RecipePickerSheet
          onClose={() => setPickerOpen(false)}
          collectionName={selected.name}
          recipes={recipes}
          manualIds={manualIds}
          filterIds={filterMatches.map((recipe) => recipe.id)}
          onToggle={handleToggleRecipe}
        />
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
