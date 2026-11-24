import { NextRequest, NextResponse } from "next/server";
import { generateRecipeImportTemplate } from "@/core/inventory/recipeExcelImporter";

export async function GET(req: NextRequest) {
  try {
    const buffer = generateRecipeImportTemplate();

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="resto-bird-recipe-template.xlsx"',
      },
    });
  } catch (error: any) {
    console.error("Template Download Error:", error);
    return NextResponse.json({ error: "Failed to generate template" }, { status: 500 });
  }
}
