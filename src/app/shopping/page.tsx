"use client";
import { useI18n } from "@/lib/i18n/context";

import { useEffect, useState } from "react";
import { useShoppingList } from "@/hooks/useShoppingList";
import type { ShoppingItem } from "@/domain/types";
import { getRecipeRepository, getShoppingListRepository } from "@/data";
import { formatAmount } from "@/lib/scale";
import { parseAmountString } from "@/parser";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Sheet } from "@/components/Sheet";
import { Field, Input } from "@/components/Input";
import { IconCart, IconCheck, IconPencil, IconPlus, IconTrash } from "@/components/Icons";

export default function ShoppingPage() {

  const { t } = useI18n();
  const { items, loading, error, retry } = useShoppingList();
  const [recipeTitles, setRecipeTitles] = useState<Record<string, string>>({});
  const [confirmClear, setConfirmClear] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [editing, setEditing] = useState<ShoppingItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editUnit, setEditUnit] = useState("");

  function openEdit(item: ShoppingItem) {
    setEditing(item);
    setEditName(item.name);
    setEditAmount(item.amount !== undefined ? String(item.amount).replace(".", ",") : "");
    setEditUnit(item.unit ?? "");
  }

  async function addManualItem() {
    const name = newItemName.trim();
    if (!name) return;
    await getShoppingListRepository().addItem({ name });
    setNewItemName("");
  }

  async function saveEdit() {
    if (!editing || !editName.trim()) return;
    await getShoppingListRepository().updateItem(editing.id, {
      name: editName,
      amount: parseAmountString(editAmount),
      unit: editUnit,
    });
    setEditing(null);
  }

  useEffect(() => {
    void getRecipeRepository()
      .list()
      .then((rs) => setRecipeTitles(Object.fromEntries(rs.map((r) => [r.id, r.title]))))
      .catch((e) => console.error("recipe titles failed", e));
  }, [items]);

  const checkedCount = items.filter((i) => i.checked).length;

  return (
    <>
      <PageHeader
        title={t("shopping.title")}
        subtitle={items.length ? `${items.length} ${items.length === 1 ? t("shopping.ingredientSingular") : t("shopping.ingredientPlural")}` : undefined}
        action={
          items.length > 0 ? (
            <button
              onClick={() => setConfirmClear(true)}
              className="pressable rounded-full px-3 py-2 text-[14px] font-medium text-danger"
            >
              Alles löschen
            </button>
          ) : undefined
        }
      />

      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void addManualItem();
        }}
      >
        <Input
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          placeholder={t("shopping.addPlaceholder")}
          aria-label="Zutat zur Einkaufsliste hinzufügen"
        />
        <Button type="submit" variant="secondary" aria-label={t("general.add")} disabled={!newItemName.trim()}>
          <IconPlus size={19} />
        </Button>
      </form>

      {error ? (
        <ErrorState message={error} onRetry={retry} />
      ) : loading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="pulse-soft h-14 rounded-ctl bg-black/[0.04]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-card bg-surface shadow-card">
          <EmptyState
            icon={<IconCart size={40} />}
            title={t("shopping.emptyTitle")}
            subtitle={t("shopping.emptySubtitle")}
          />
        </div>
      ) : (
        <>
          <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface shadow-card">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-3 py-1.5">
                <label className="flex min-h-[44px] flex-1 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => void getShoppingListRepository().toggle(item.id)}
                    aria-label={`${item.name} abhaken`}
                    className="peer sr-only"
                  />
                  <span
                    aria-hidden
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-ink-3/50 text-transparent transition-colors peer-checked:border-accent peer-checked:bg-accent peer-checked:text-white"
                  >
                    <IconCheck size={14} />
                  </span>
                  <span className={`min-w-0 flex-1 text-[15px] ${item.checked ? "text-ink-3 line-through" : ""}`}>
                    {formatAmount(item.amount, item.unit) && (
                      <span className="mr-1.5 font-semibold tabular-nums text-ink-2">
                        {formatAmount(item.amount, item.unit)}
                      </span>
                    )}
                    {item.name}
                    {item.recipeIds.length > 0 && recipeTitles[item.recipeIds[0]] && (
                      <span className="block text-[12px] text-ink-3">
                        aus „{recipeTitles[item.recipeIds[0]]}“
                        {item.recipeIds.length > 1 ? ` +${item.recipeIds.length - 1}` : ""}
                      </span>
                    )}
                  </span>
                </label>
                <button
                  aria-label={`${item.name} bearbeiten`}
                  onClick={() => openEdit(item)}
                  className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-3 hover:text-ink"
                >
                  <IconPencil size={17} />
                </button>
                <button
                  aria-label={`${item.name} löschen`}
                  onClick={() => void getShoppingListRepository().remove(item.id)}
                  className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-3 hover:text-danger"
                >
                  <IconTrash size={17} />
                </button>
              </li>
            ))}
          </ul>

          {checkedCount > 0 && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="secondary"
                onClick={() => void getShoppingListRepository().clearChecked()}
              >
                <IconCheck size={17} /> Erledigte entfernen ({checkedCount})
              </Button>
            </div>
          )}
        </>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={t("shopping.editTitle")}>
        <div className="flex flex-col gap-4">
          <Field label={t("shopping.ingredientSingular")} htmlFor="edit-name">
            <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("shopping.editAmount")} htmlFor="edit-amount">
              <Input
                id="edit-amount"
                inputMode="decimal"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                placeholder="2,5"
              />
            </Field>
            <Field label={t("shopping.editUnit")} htmlFor="edit-unit">
              <Input
                id="edit-unit"
                value={editUnit}
                onChange={(e) => setEditUnit(e.target.value)}
                placeholder="g"
              />
            </Field>
          </div>
          <Button size="lg" fullWidth onClick={() => void saveEdit()} disabled={!editName.trim()}>
            Speichern
          </Button>
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmClear}
        title={t("shopping.clearConfirmTitle")}
        message={t("shopping.clearConfirmMessage")}
        confirmLabel={t("shopping.clearAll")}
        onConfirm={() => {
          void getShoppingListRepository().clearAll();
          setConfirmClear(false);
        }}
        onCancel={() => setConfirmClear(false)}
      />
    </>
  );
}
