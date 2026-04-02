import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ArrowLeft, Eye, EyeOff, Sun, Moon, Monitor, Plus, Trash2, Star, StarOff } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { nanoid } from "nanoid";
import type { AiProvider } from "@/types/workflow";

interface EnvVariable {
  key: string;
  value: string;
  var_type: string;
  description: string;
}

interface SettingsPageProps {
  onBack: () => void;
}

export function SettingsPage({ onBack }: SettingsPageProps) {
  const [providers, setProviders] = useState<AiProvider[]>([]);
  const [saving, setSaving] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [envVars, setEnvVars] = useState<EnvVariable[]>([]);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    invoke<string>("get_ai_settings")
      .then((json) => setProviders(JSON.parse(json)))
      .catch((e) => {
        console.error("加载设置失败:", e);
        toast.error("加载 AI 设置失败");
      });
    invoke<string>("get_env_variables")
      .then((json) => setEnvVars(JSON.parse(json)))
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await invoke("save_ai_settings", {
        providersJson: JSON.stringify(providers),
      });
      await invoke("save_env_variables", {
        varsJson: JSON.stringify(envVars),
      });
      toast.success("设置已保存");
    } catch (e) {
      console.error("保存设置失败:", e);
      toast.error("保存设置失败");
    } finally {
      setSaving(false);
    }
  };

  const addProvider = () => {
    setProviders((prev) => [
      ...prev,
      {
        id: `provider_${nanoid(8)}`,
        name: "",
        provider_type: "openai",
        api_base: "",
        api_key: "",
        model: "",
        is_default: prev.length === 0,
      },
    ]);
  };

  const updateProvider = (id: string, field: keyof AiProvider, value: string | boolean) => {
    setProviders((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          if (field === "is_default" && value === true) {
            return { ...p, is_default: true };
          }
          return { ...p, [field]: value };
        }
        // When setting a new default, unset others
        if (field === "is_default" && value === true) {
          return { ...p, is_default: false };
        }
        return p;
      })
    );
  };

  const removeProvider = (id: string) => {
    setProviders((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      // If we removed the default, set first one as default
      if (filtered.length > 0 && !filtered.some((p) => p.is_default)) {
        filtered[0].is_default = true;
      }
      return filtered;
    });
  };

  return (
    <div className="w-screen h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex items-center justify-between px-8 h-14 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="text-base font-semibold">设置</span>
        </div>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          保存设置
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-10">
          {/* Theme */}
          <div className="mb-10">
            <h2 className="text-base font-semibold tracking-tight">外观</h2>
            <p className="text-sm text-muted-foreground mt-1">选择主题模式</p>
            <div className="flex gap-2 mt-3">
              {([
                { value: "light" as const, label: "浅色", icon: Sun },
                { value: "dark" as const, label: "深色", icon: Moon },
                { value: "system" as const, label: "跟随系统", icon: Monitor },
              ]).map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  variant={theme === value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme(value)}
                >
                  <Icon className="h-3.5 w-3.5 mr-1.5" />
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {/* AI Providers */}
          <div className="mb-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold tracking-tight">AI 提供商</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  自由添加任意数量的 AI 服务，工作流节点可直接选用
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={addProvider}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                添加
              </Button>
            </div>
          </div>

          {providers.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg py-12 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                还没有配置任何 AI 提供商
              </p>
              <Button variant="outline" size="sm" onClick={addProvider}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                添加第一个提供商
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {providers.map((provider) => (
                <div
                  key={provider.id}
                  className={`border rounded-lg p-5 transition-colors ${
                    provider.is_default
                      ? "border-primary/40 bg-primary/[0.02]"
                      : "border-border"
                  }`}
                >
                  {/* Provider header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Input
                        value={provider.name}
                        onChange={(e) => updateProvider(provider.id, "name", e.target.value)}
                        className="h-8 text-sm font-semibold w-48 border-none shadow-none px-0 focus-visible:ring-0"
                        placeholder="起个名字，如「DeepSeek」"
                      />
                      {provider.is_default && (
                        <span className="text-[10px] text-primary font-medium bg-primary/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                          默认
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title={provider.is_default ? "已是默认" : "设为默认"}
                        onClick={() => updateProvider(provider.id, "is_default", true)}
                      >
                        {provider.is_default ? (
                          <Star className="h-3.5 w-3.5 text-primary fill-primary" />
                        ) : (
                          <StarOff className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        title="删除"
                        onClick={() => removeProvider(provider.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Fields */}
                  <div className="grid gap-3">
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-xs text-muted-foreground mb-1 block">API Base URL</label>
                        <Input
                          value={provider.api_base}
                          onChange={(e) => updateProvider(provider.id, "api_base", e.target.value)}
                          className="h-8 text-xs font-mono"
                          placeholder="https://api.openai.com/v1"
                        />
                      </div>
                      <div className="w-32">
                        <label className="text-xs text-muted-foreground mb-1 block">API 类型</label>
                        <Select value={provider.provider_type} onValueChange={(v) => updateProvider(provider.id, "provider_type", v)}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="openai">OpenAI 兼容</SelectItem>
                            <SelectItem value="claude">Claude</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">API Key</label>
                      <div className="relative">
                        <Input
                          type={showKeys[provider.id] ? "text" : "password"}
                          value={provider.api_key}
                          onChange={(e) => updateProvider(provider.id, "api_key", e.target.value)}
                          className="h-8 text-xs font-mono pr-9"
                          placeholder="sk-..."
                        />
                        <button
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            setShowKeys((prev) => ({
                              ...prev,
                              [provider.id]: !prev[provider.id],
                            }))
                          }
                        >
                          {showKeys[provider.id] ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">模型</label>
                      <Input
                        value={provider.model}
                        onChange={(e) => updateProvider(provider.id, "model", e.target.value)}
                        className="h-8 text-xs"
                        placeholder="gpt-4o / deepseek-chat / claude-sonnet-4-20250514"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Separator className="my-8" />

          {/* Environment Variables */}
          <div className="mb-5">
            <h2 className="text-base font-semibold tracking-tight">环境变量</h2>
            <p className="text-sm text-muted-foreground mt-1">
              全局变量，在工作流中用 <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">{"{{env.KEY}}"}</code> 引用
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {envVars.map((v, i) => (
              <div key={i} className="border border-border rounded-lg p-4 grid gap-2">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">变量名</label>
                    <Input
                      value={v.key}
                      onChange={(e) => {
                        const next = [...envVars];
                        next[i] = { ...next[i], key: e.target.value };
                        setEnvVars(next);
                      }}
                      className="h-8 text-xs font-mono"
                      placeholder="API_KEY"
                    />
                  </div>
                  <div className="w-24">
                    <label className="text-xs text-muted-foreground mb-1 block">类型</label>
                    <Select value={v.var_type} onValueChange={(val) => {
                      const next = [...envVars];
                      next[i] = { ...next[i], var_type: val };
                      setEnvVars(next);
                    }}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="string">文本</SelectItem>
                        <SelectItem value="number">数字</SelectItem>
                        <SelectItem value="secret">密钥</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setEnvVars(envVars.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">值</label>
                    <Input
                      type={v.var_type === "secret" ? "password" : "text"}
                      value={v.value}
                      onChange={(e) => {
                        const next = [...envVars];
                        next[i] = { ...next[i], value: e.target.value };
                        setEnvVars(next);
                      }}
                      className="h-8 text-xs font-mono"
                      placeholder="变量值"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">描述</label>
                    <Input
                      value={v.description}
                      onChange={(e) => {
                        const next = [...envVars];
                        next[i] = { ...next[i], description: e.target.value };
                        setEnvVars(next);
                      }}
                      className="h-8 text-xs"
                      placeholder="可选说明"
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs"
              onClick={() => setEnvVars([...envVars, { key: "", value: "", var_type: "string", description: "" }])}
            >
              <Plus className="h-3 w-3 mr-1" />
              添加变量
            </Button>
          </div>

          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}
