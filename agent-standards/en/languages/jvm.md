# JVM — Java & Scala — Language Layer (load on demand)

Modern JVM engineering. Read this only when the task touches Java or Scala. It applies on top of
the global `AGENTS.md` (universal conduct + lifecycle craft); a repo's own rules win. The shared
section applies to both languages; language-specific guidance follows.

## Shared (Java & Scala)

- Target a current **LTS JVM (21+)**. Pin the toolchain (a build-tool toolchain or
  `.sdkmanrc`) for reproducible builds.
- Manage versions centrally with a **BOM**/platform; commit the resolved/lock state. Keep
  format, lint, test, and build in CI.
- Default to **immutability** and explicit nullability. Close resources deterministically
  (try-with-resources / bracket). Prefer **structured concurrency** and virtual threads
  (21+) for IO concurrency over hand-rolled thread pools.
- Profile with JFR / async-profiler before optimizing. Never leak a resource or swallow
  `InterruptedException`.

## Java

- Use the modern language: **records** for data, **sealed** types + **pattern-matching
  `switch`** for closed hierarchies, `var` for obvious locals, text blocks for multi-line
  strings.
- Return **`Optional`**, never `null`, for "maybe absent." Make fields `final`; expose
  unmodifiable collections. Use streams for transformation pipelines — not as a replacement
  for a clear loop.
- Exceptions: unchecked for programming errors; don't abuse or swallow checked exceptions.
  Always preserve the cause.
- Build with **Gradle (Kotlin DSL)** or Maven + a BOM. Test with **JUnit 5 + AssertJ**;
  mock sparingly (Mockito) and only at boundaries. Format with Spotless /
  google-java-format. Consider JSpecify nullness annotations.

## Scala

- Prefer **Scala 3** (2.13 only if constrained). Build with **sbt** or **mill**.
- Immutability and expressions: `val` over `var`, `case class`/`enum` for ADTs, immutable
  collections, pattern matching. Model absence and failure with `Option`/`Either`, not
  `null` or exceptions.
- Use `given`/`using` deliberately for type classes — don't bury behavior in implicit soup.
  Keep functions total; push side effects to the edges.
- If you use an effect system (**cats-effect** / **ZIO**), keep effects at the boundary and
  the core pure — but don't adopt one without need.
- Format with **scalafmt**; lint with **scalafix** (+ wartremover). Test with **munit** or
  ScalaTest.

## Build & packaging

- Build a single versioned artifact via Gradle or Maven. Applications: prefer a runnable jar or
  a trimmed `jlink` runtime image / container — or GraalVM **native-image** where fast startup
  matters. Libraries: publish a POM with sources and javadoc, signed.
- Manage versions centrally (BOM) and aim for reproducible builds. Scala: produce a fat jar
  (sbt-assembly / sbt-native-packager) and publish cross-version artifacts. Keep format, lint,
  test, and build in CI.

## Common pitfalls

- **Java**: returning or accepting `null`; broken `equals`/`hashCode`; mutable static
  state; checked-exception abuse; streams where a loop is clearer; unintended autoboxing in
  hot loops.
- **Scala**: implicit/`given` overuse and operator soup; leaking `var`; non-exhaustive or
  partial-function matches; blocking inside an effect or `Future`; inheritance where
  composition fits.
