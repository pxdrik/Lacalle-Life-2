"use client";

import { Copy, Download, ShoppingCart } from "lucide-react";
import { useState } from "react";

import { Button } from "@/design-system/components/button";
import { Dialog } from "@/design-system/components/dialog";
import { Skeleton } from "@/design-system/components/skeleton";
import { useToast } from "@/design-system/components/toast";
import { useFoodCatalogue } from "@/features/foods";

import {
  buildShoppingList,
  formatAmount,
  shoppingListText,
  type ShoppingList,
} from "../services/shopping-list";
import { shoppingListPdf } from "../services/shopping-list-pdf";
import type { Diet } from "../types/diet";

/**
 * O que comprar para a semana, a partir das dietas com dias marcados.
 *
 * Um modal, não um painel: é consulta (nada da lista atrás muda enquanto ele
 * está aberto), a mesma pergunta que `Dialog` documenta.
 */
export function ShoppingListButton({ diets }: { readonly diets: readonly Diet[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setOpen(true);
        }}
      >
        <ShoppingCart aria-hidden className="size-4" />
        Lista de compras
      </Button>

      <Dialog
        open={open}
        title="Lista de compras da semana"
        onClose={() => {
          setOpen(false);
        }}
      >
        {/* Só monta aberto: carregar o catálogo inteiro para agrupar por
            categoria é trabalho que ninguém pediu enquanto o modal está fechado. */}
        {open && <ShoppingListBody diets={diets} />}
      </Dialog>
    </>
  );
}

function ShoppingListBody({ diets }: { readonly diets: readonly Diet[] }) {
  const { state } = useFoodCatalogue();
  const toast = useToast();

  if (state.status === "loading") return <Skeleton className="h-40 rounded-lg" />;

  // Catálogo que falhou em carregar não derruba a lista: só perde o
  // agrupamento (tudo cai em "Outros"), e a quantidade continua certa.
  const categories = new Map(
    state.status === "ready" ? state.foods.map((food) => [food.id, food.category]) : [],
  );
  const list = buildShoppingList(diets, (foodId) => categories.get(foodId));

  if (list.groups.length === 0) {
    return (
      <div className="space-y-1.5">
        <p className="text-ink">Nada para listar ainda.</p>
        <p className="text-sm text-ink-subtle">
          A lista soma as dietas que têm dias da semana marcados. Marque os dias de uma
          dieta e ponha alimentos nas refeições dela.
        </p>
      </div>
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shoppingListText(list));
      toast("Lista copiada.");
    } catch {
      toast("Não foi possível copiar.");
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-subtle">
        Dietas: {list.sources.map((source) => `${source.name} (${source.days})`).join(", ")}
      </p>

      {/* No alto, não no fim: com a lista longa, o que se faz com ela não pode
          depender de rolar tudo no celular. */}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => void copy()}>
          <Copy aria-hidden className="size-4" />
          Copiar texto
        </Button>
        <Button
          size="sm"
          onClick={() => {
            download(list);
          }}
        >
          <Download aria-hidden className="size-4" />
          Baixar PDF
        </Button>
      </div>

      <ListGroups list={list} />
    </div>
  );
}

function ListGroups({ list }: { readonly list: ShoppingList }) {
  return (
    <div className="space-y-5">
      {list.groups.map((group) => (
        <section key={group.title}>
          <h3 className="mb-1.5 text-xs font-medium tracking-wide text-ink-subtle uppercase">
            {group.title}
          </h3>
          <ul className="divide-y divide-line">
            {group.items.map((item) => (
              <li
                key={`${item.name}|${item.unit}`}
                className="flex items-baseline justify-between gap-4 py-2"
              >
                <span className="min-w-0 text-ink">{item.name}</span>
                <span className="shrink-0 font-medium text-ink tabular-nums">
                  {formatAmount(item.amount, item.unit)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function download(list: ShoppingList) {
  const url = URL.createObjectURL(
    new Blob([shoppingListPdf(list)], { type: "application/pdf" }),
  );

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "lista-de-compras.pdf";
  anchor.click();

  // Adiado: soltar o endereço no mesmo instante do clique faz alguns navegadores
  // cancelarem o download antes de começar.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
