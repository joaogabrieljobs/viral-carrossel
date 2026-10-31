// Gerado por scripts/import-font-library.py. Não editar manualmente.
export const LOCAL_TITLE_FONTS = Object.freeze([
  {
    "name": "Inter",
    "val": "\"Moont Library Inter\", sans-serif",
    "cat": "sans",
    "local": true
  },
  {
    "name": "Roboto",
    "val": "\"Moont Library Roboto\", sans-serif",
    "cat": "sans",
    "local": true
  }
]);

export const LOCAL_BODY_FONTS = Object.freeze([
  {
    "name": "Inter",
    "val": "\"Moont Library Inter\", sans-serif",
    "cat": "sans",
    "local": true
  },
  {
    "name": "Roboto",
    "val": "\"Moont Library Roboto\", sans-serif",
    "cat": "sans",
    "local": true
  }
]);

export const LOCAL_FONT_FAMILIES = new Set(LOCAL_TITLE_FONTS.map(({ val }) => val.split(',')[0].trim().replace(/^[\"']|[\"']$/g, '')));
