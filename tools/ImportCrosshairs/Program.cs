using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

static string? Env(string name)
{
    var value = Environment.GetEnvironmentVariable(name);
    return string.IsNullOrWhiteSpace(value) ? null : value;
}

static int Usage()
{
    Console.Error.WriteLine("Usage: dotnet run --project tools/ImportCrosshairs -- path/to/crosshairs.json");
    Console.Error.WriteLine();
    Console.Error.WriteLine("Required environment variables:");
    Console.Error.WriteLine("  SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co");
    Console.Error.WriteLine("  SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY");
    Console.Error.WriteLine();
    Console.Error.WriteLine("Optional environment variables:");
    Console.Error.WriteLine("  SUPABASE_TABLE=crosshairs");
    return 2;
}

static async Task<int> MainAsync(string[] args)
{
    if (args.Length != 1) return Usage();

    var supabaseUrl = Env("SUPABASE_URL");
    var serviceRoleKey = Env("SUPABASE_SERVICE_ROLE_KEY");
    var table = Env("SUPABASE_TABLE") ?? "crosshairs";

    if (supabaseUrl is null || serviceRoleKey is null) return Usage();

    var inputPath = args[0];
    if (!File.Exists(inputPath))
    {
        Console.Error.WriteLine($"Input file not found: {inputPath}");
        return 1;
    }

    var json = await File.ReadAllTextAsync(inputPath, Encoding.UTF8);
    try
    {
        using var _ = JsonDocument.Parse(json);
    }
    catch (JsonException ex)
    {
        Console.Error.WriteLine($"Input file is not valid JSON: {ex.Message}");
        return 1;
    }

    var endpoint = $"{supabaseUrl.TrimEnd('/')}/rest/v1/{Uri.EscapeDataString(table)}";
    using var client = new HttpClient();
    using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);

    request.Headers.Add("apikey", serviceRoleKey);
    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", serviceRoleKey);
    request.Headers.Add("Prefer", "return=representation");
    request.Content = new StringContent(json, Encoding.UTF8, "application/json");

    using var response = await client.SendAsync(request);
    var body = await response.Content.ReadAsStringAsync();

    Console.WriteLine($"Supabase HTTP status: {(int)response.StatusCode}");
    if (!string.IsNullOrWhiteSpace(body)) Console.WriteLine(body);

    return response.IsSuccessStatusCode ? 0 : 1;
}

return await MainAsync(args);
