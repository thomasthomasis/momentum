using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace Momentum.Api.Services;

public interface IPairingCodeStore
{
    /// <summary>Generates a single-use code bound to the given user, valid for `ttl`.</summary>
    string Generate(string userId, TimeSpan ttl);

    /// <summary>Consumes a code if it exists and hasn't expired — one-time use, so a
    /// replayed code always fails. Returns the bound user id, or null if invalid.</summary>
    string? Consume(string code);
}

/// <summary>
/// In-memory pairing-code store for the desktop agent's login flow (device-pairing
/// pattern, similar to `docker login` / smart-TV OAuth). Codes are short-lived
/// (~5 minutes) and single-use, so an in-memory dictionary is sufficient — there's
/// no need for these to survive an app restart or be shared across instances.
/// </summary>
public class PairingCodeStore : IPairingCodeStore
{
    // Excludes visually ambiguous characters (0/O, 1/I) so codes are easy to type.
    private const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private const int CodeLength = 8;

    private record Entry(string UserId, DateTime ExpiresAt);

    private readonly ConcurrentDictionary<string, Entry> _codes = new();

    public string Generate(string userId, TimeSpan ttl)
    {
        PurgeExpired();

        string code;
        do { code = GenerateCode(); } while (!_codes.TryAdd(code, new Entry(userId, DateTime.UtcNow.Add(ttl))));

        return code;
    }

    public string? Consume(string code)
    {
        var normalized = Normalize(code);
        if (!_codes.TryRemove(normalized, out var entry)) return null;
        return entry.ExpiresAt >= DateTime.UtcNow ? entry.UserId : null;
    }

    private static string Normalize(string code) =>
        new(code.Where(char.IsLetterOrDigit).Select(char.ToUpperInvariant).ToArray());

    private static string GenerateCode()
    {
        var bytes = RandomNumberGenerator.GetBytes(CodeLength);
        var chars = new char[CodeLength];
        for (var i = 0; i < CodeLength; i++)
            chars[i] = Alphabet[bytes[i] % Alphabet.Length];
        return new string(chars);
    }

    private void PurgeExpired()
    {
        var now = DateTime.UtcNow;
        foreach (var (key, entry) in _codes)
            if (entry.ExpiresAt < now) _codes.TryRemove(key, out _);
    }
}
