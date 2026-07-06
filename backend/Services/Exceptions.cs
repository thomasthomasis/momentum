namespace Momentum.Api.Services;

/// <summary>Thrown when a requested resource does not exist. Maps to HTTP 404.</summary>
public class NotFoundException : Exception
{
    public NotFoundException(string message) : base(message) { }
}

/// <summary>Thrown on a conflicting state (e.g. duplicate name). Maps to HTTP 409.</summary>
public class ConflictException : Exception
{
    public ConflictException(string message) : base(message) { }
}

/// <summary>Thrown on semantic validation failures. Maps to HTTP 422.</summary>
public class ValidationException : Exception
{
    public ValidationException(string message) : base(message) { }
}