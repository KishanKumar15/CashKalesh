namespace PersonalFinanceTracker.Api.Common;

public static class UtcDateTime
{
    public static DateTime EnsureUtc(DateTime value)
        => value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };

    public static DateTime? EnsureUtc(DateTime? value)
        => value.HasValue ? EnsureUtc(value.Value) : null;

    public static DateTime StartOfDayUtc(DateTime value)
    {
        var utcValue = EnsureUtc(value);
        return new DateTime(utcValue.Year, utcValue.Month, utcValue.Day, 0, 0, 0, DateTimeKind.Utc);
    }

    public static DateTime StartOfMonthUtc(DateTime value)
    {
        var utcValue = EnsureUtc(value);
        return new DateTime(utcValue.Year, utcValue.Month, 1, 0, 0, 0, DateTimeKind.Utc);
    }

    public static DateTime CreateUtcDate(int year, int month, int day)
        => new(year, month, day, 0, 0, 0, DateTimeKind.Utc);
}
