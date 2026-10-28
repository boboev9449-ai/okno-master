import { useState } from "react";
import { downloadBytes } from "@/lib/okno/pdf";
import { useOkno } from "@/lib/okno/store";
import type { ProfileMethod, Rounding } from "@/lib/okno/types";
import { Shell, useReady } from "@/components/okno/shell";
import {
  Button,
  Card,
  Field,
  Modal,
  NumberInput,
  PageTitle,
  Select,
  TextInput,
} from "@/components/okno/ui";

export function SettingsPage() {
  return (
    <Shell>
      <SettingsBody />
    </Shell>
  );
}

function SettingsBody() {
  const ready = useReady();
  const settings = useOkno((state) => state.settings);
  const updateSettings = useOkno((state) => state.updateSettings);
  const exportBackup = useOkno((state) => state.exportBackup);
  const importBackup = useOkno((state) => state.importBackup);
  const setNotice = useOkno((state) => state.setNotice);
  const [confirmImport, setConfirmImport] = useState<string | null>(null);

  if (!ready) return <p className="text-sm text-muted">Загрузка данных…</p>;

  return (
    <>
      <PageTitle
        title="Настройки"
        text="Компания, валюта, округление, тариф монтажа и пределы размеров. Данные хранятся в этом браузере; регулярно скачивайте JSON-резервную копию."
      />
      <div className="grid gap-4">
        <Card className="grid gap-3">
          <h2 className="text-base font-semibold">Компания</h2>
          <Field label="Название">
            <TextInput
              value={settings.companyName}
              onChange={(event) => updateSettings({ companyName: event.target.value })}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Телефон">
              <TextInput
                value={settings.phone}
                onChange={(event) => updateSettings({ phone: event.target.value })}
              />
            </Field>
            <Field label="Почта">
              <TextInput
                value={settings.email}
                onChange={(event) => updateSettings({ email: event.target.value })}
              />
            </Field>
          </div>
          <Field label="Адрес">
            <TextInput
              value={settings.address}
              onChange={(event) => updateSettings({ address: event.target.value })}
            />
          </Field>
          <Field label="Логотип" hint="PNG или JPEG до 350 КБ. Попадёт в PDF.">
            <input
              type="file"
              accept="image/png,image/jpeg"
              className="text-sm"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.size > 350_000) {
                  setNotice("Логотип больше 350 КБ.");
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => updateSettings({ logoDataUrl: String(reader.result) });
                reader.readAsDataURL(file);
              }}
            />
          </Field>
          {settings.logoDataUrl ? (
            <div className="flex items-center gap-3">
              <img
                src={settings.logoDataUrl}
                alt="Логотип компании"
                className="h-12 w-auto rounded-md border border-line bg-bg"
              />
              <Button variant="ghost" onClick={() => updateSettings({ logoDataUrl: null })}>
                Убрать логотип
              </Button>
            </div>
          ) : null}
        </Card>

        <Card className="grid gap-3 sm:grid-cols-2">
          <h2 className="text-base font-semibold sm:col-span-2">Расчёты</h2>
          <Field label="Валюта">
            <Select
              value={settings.currency}
              onChange={(event) => updateSettings({ currency: event.target.value })}
            >
              <option value="TJS">Таджикский сомони (TJS)</option>
              <option value="RUB">Российский рубль</option>
              <option value="USD">Доллар США</option>
              <option value="EUR">Евро</option>
            </Select>
          </Field>
          <Field label="Округление">
            <Select
              value={settings.rounding}
              onChange={(event) => updateSettings({ rounding: event.target.value as Rounding })}
            >
              <option value="0.01">До 0,01</option>
              <option value="0.1">До 0,1</option>
              <option value="1">До 1</option>
              <option value="10">До 10</option>
            </Select>
          </Field>
          <Field
            label="Минимальная площадь стеклопакета, м²"
            hint="0 — без минимума. Считается отдельно для каждой секции."
          >
            <NumberInput
              value={settings.minGlassAreaM2}
              onChange={(minGlassAreaM2) => updateSettings({ minGlassAreaM2 })}
            />
          </Field>
          <Field
            label="Наценка по умолчанию, %"
            hint="Кнопка в карточке материала. Сама по себе цену в заказе не меняет."
          >
            <NumberInput
              value={settings.defaultMarkupPercent}
              onChange={(defaultMarkupPercent) => updateSettings({ defaultMarkupPercent })}
            />
          </Field>
          <Field label="Монтаж, продажа за м²">
            <NumberInput
              value={settings.installSalePerM2}
              onChange={(installSalePerM2) => updateSettings({ installSalePerM2 })}
            />
          </Field>
          <Field label="Монтаж, себестоимость за м²">
            <NumberInput
              value={settings.installCostPerM2}
              onChange={(installCostPerM2) => updateSettings({ installCostPerM2 })}
            />
          </Field>
          <Field
            label="Вычет габарита створки, мм"
            hint="0 — длина створки по полному размеру секции, без производственного коэффициента."
          >
            <NumberInput
              value={settings.profileDeductionMm}
              onChange={(profileDeductionMm) => updateSettings({ profileDeductionMm })}
            />
          </Field>
          <Field label="Метод профиля по умолчанию">
            <Select
              value={settings.defaultMethod}
              onChange={(event) =>
                updateSettings({ defaultMethod: event.target.value as ProfileMethod })
              }
            >
              <option value="elements">По элементам</option>
              <option value="area">По площади</option>
            </Select>
          </Field>
          <Field label="Минимальная ширина, мм">
            <NumberInput
              value={settings.minWidthMm}
              onChange={(minWidthMm) => updateSettings({ minWidthMm })}
            />
          </Field>
          <Field label="Максимальная ширина, мм">
            <NumberInput
              value={settings.maxWidthMm}
              onChange={(maxWidthMm) => updateSettings({ maxWidthMm })}
            />
          </Field>
          <Field label="Минимальная высота, мм">
            <NumberInput
              value={settings.minHeightMm}
              onChange={(minHeightMm) => updateSettings({ minHeightMm })}
            />
          </Field>
          <Field label="Максимальная высота, мм">
            <NumberInput
              value={settings.maxHeightMm}
              onChange={(maxHeightMm) => updateSettings({ maxHeightMm })}
            />
          </Field>
        </Card>

        <Card className="grid gap-3">
          <h2 className="text-base font-semibold">Тема</h2>
          <div className="flex gap-2">
            <Button
              variant={settings.theme === "light" ? "primary" : "ghost"}
              onClick={() => updateSettings({ theme: "light" })}
            >
              Светлая
            </Button>
            <Button
              variant={settings.theme === "dark" ? "primary" : "ghost"}
              onClick={() => updateSettings({ theme: "dark" })}
            >
              Тёмная
            </Button>
          </div>
        </Card>

        <Card className="grid gap-3">
          <h2 className="text-base font-semibold">Резервная копия</h2>
          <p className="text-sm text-muted">
            Файл содержит клиентов, объекты, прайс, заказы и настройки. Для переноса данных скачайте
            файл здесь и загрузите его на другом устройстве.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                const raw = exportBackup();
                downloadBytes(
                  new TextEncoder().encode(raw),
                  `okno-master-${new Date().toISOString().slice(0, 10)}.json`,
                  "application/json",
                );
              }}
            >
              Скачать копию
            </Button>
            <label className="inline-flex h-11 cursor-pointer items-center rounded-md border border-line bg-surface px-4 text-sm font-semibold">
              Загрузить копию
              <input
                type="file"
                accept="application/json"
                className="sr-only"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  setConfirmImport(await file.text());
                }}
              />
            </label>
          </div>
        </Card>
      </div>
      <Modal
        open={Boolean(confirmImport)}
        title="Заменить все данные?"
        onClose={() => setConfirmImport(null)}
      >
        <p className="mb-4 text-sm text-muted">
          Текущие клиенты, заказы и прайс в этом браузере будут заменены содержимым файла.
        </p>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              if (!confirmImport) return;
              const error = importBackup(confirmImport);
              setConfirmImport(null);
              if (error) setNotice(error);
            }}
          >
            Восстановить
          </Button>
          <Button variant="ghost" onClick={() => setConfirmImport(null)}>
            Отмена
          </Button>
        </div>
      </Modal>
    </>
  );
}
