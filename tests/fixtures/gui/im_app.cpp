#include "imgui.h"

static char name[64] = "";
static float gain = 0.5f;

void drawTools() {
    ImGui::SetNextWindowPos(ImVec2(20, 20));
    ImGui::SetNextWindowSize(ImVec2(300, 200));
    ImGui::Begin("Tools");
    ImGui::Text("Name");
    ImGui::InputText("##name", name, sizeof(name));
    if (ImGui::Button("Add")) { /* add it */ }
    ImGui::SameLine();
    if (ImGui::Button("Clear", ImVec2(80, 0))) { name[0] = 0; }
    ImGui::SliderFloat("Gain", &gain, 0.0f, 1.0f);
    ImGui::SetCursorPos(ImVec2(10, 170));
    ImGui::Text("Ready");
    ImGui::End();

    ImGui::Begin("Log");
    ImGui::Text("Nothing yet");
    ImGui::End();
}
